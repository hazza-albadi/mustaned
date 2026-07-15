import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME } from "@/lib/roles";
import type { Role } from "@/types";

const PUBLIC_PATHS = ["/login", "/auth", "/_next", "/favicon.ico"];
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// S-12: CSRF defense-in-depth for mutating API routes. The app doesn't set
// permissive CORS anywhere, and Supabase's session cookie defaults to
// SameSite=Lax, both of which already block the typical cross-site
// credentialed-fetch CSRF case — but that's an implicit property of the
// current config, not something enforced here, so it's a single point of
// failure if either ever changes (e.g. CORS relaxed for a future
// integration). This makes the check explicit: any state-changing request to
// /api/* must claim to be same-origin via Sec-Fetch-Site (modern browsers)
// or a matching Origin header (older/non-fetch clients); requests with
// neither header are allowed through rather than blocked, since some
// legitimate non-browser or same-origin-but-header-stripping proxies omit
// both — this narrows the attack surface without breaking those.
function isCrossSiteMutation(request: NextRequest): boolean {
  if (!UNSAFE_METHODS.has(request.method)) return false;
  if (!request.nextUrl.pathname.startsWith("/api/")) return false;

  const secFetchSite = request.headers.get("sec-fetch-site");
  if (secFetchSite) return secFetchSite !== "same-origin" && secFetchSite !== "none";

  const origin = request.headers.get("origin");
  if (origin) return origin !== request.nextUrl.origin;

  return false;
}

// Perf: every page's requireProfile()/getCurrentProfile() independently
// re-runs auth.getUser() + a profiles select, on top of the identical work
// middleware just did for every gated path — over a ~230ms RTT to the
// Supabase region, that's 2 extra network round trips added to every single
// navigation. Middleware forwards its own already-fetched profile via this
// header so the page can skip re-fetching it entirely; getCurrentProfile()
// still falls back to the original DB round-trip whenever the header is
// absent (paths middleware doesn't gate, or any future direct-hit path), so
// this is a pure fast-path — never a trust boundary. The header value is
// always freshly computed and overwritten here, never merged with whatever
// a client sent, so a client cannot spoof it past middleware.
const PROFILE_HEADER = "x-forwarded-profile";

export async function updateSession(request: NextRequest) {
  if (isCrossSiteMutation(request)) {
    return NextResponse.json({ error: "Cross-site request blocked" }, { status: 403 });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  // "/" is the public intro/landing page — matched exactly (not via
  // startsWith) so it doesn't accidentally make every route public.
  const isPublic = path === "/" || PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", path);
    return NextResponse.redirect(url);
  }

  function redirectTo(pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (user && path === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return redirectTo(profile ? ROLE_HOME[profile.role as Role] ?? "/forms" : "/forms");
  }

  const isGatedPath =
    path === "/dashboard" ||
    path.startsWith("/dashboard/") ||
    path.startsWith("/admin") ||
    path === "/forms" ||
    path.startsWith("/forms/") ||
    path === "/my-submissions" ||
    path.startsWith("/my-submissions/");

  // Broader than isGatedPath on purpose — /fill/[formId] and "/" both call
  // getCurrentProfile() themselves (form routing, home redirect) but aren't
  // role-redirect-gated here, so they still benefit from the forwarded
  // profile even though they don't hit the redirect logic below.
  const needsProfile = isGatedPath || path === "/" || path.startsWith("/fill/");

  if (user && needsProfile) {
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();

    if (profile) {
      const requestHeaders = new Headers(request.headers);
      // HTTP header values must be ByteString (Latin1-range only) — profile
      // names routinely contain Arabic (name_ar), which throws in
      // Headers.set() otherwise. encodeURIComponent produces an ASCII-only
      // string safe for a header value; getCurrentProfile() decodes it back.
      requestHeaders.set(PROFILE_HEADER, encodeURIComponent(JSON.stringify(profile)));
      supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
    }

    const role = profile?.role as Role | undefined;

    if (isGatedPath && !role) {
      return redirectTo("/forms");
    }

    // Everything below is redirect logic scoped to isGatedPath prefixes
    // (dashboard/forms/my-submissions/admin) — role is only possibly
    // undefined for the non-gated paths (/, /fill/) added to `needsProfile`
    // above, which never match any of these prefixes, but this guard keeps
    // that guarantee explicit for TypeScript too.
    if (role) {
      // /dashboard — Department Head only ("their own submissions"). Employees
      // and Super Admin get bounced to their own home page.
      if (path === "/dashboard" || path.startsWith("/dashboard/")) {
        if (role !== "DEPARTMENT_HEAD") return redirectTo(ROLE_HOME[role]);
      }

      // /forms — Employee and Department Head only (form-filling flow). Super
      // Admin and Admin are system-access roles, not form-submitters.
      if (path === "/forms" || path.startsWith("/forms/")) {
        if (role === "SUPER_ADMIN" || role === "ADMIN") return redirectTo("/admin");
      }

      // /my-submissions — Employee only ("their own submissions" view; Department
      // Head has the equivalent at /dashboard, Super Admin has no submissions).
      if (path === "/my-submissions" || path.startsWith("/my-submissions/")) {
        if (role !== "EMPLOYEE") return redirectTo(ROLE_HOME[role]);
      }

      // /admin — Department Head (their approval queue), Super Admin
      // (unrestricted), and Admin (per granted permission) only. Employees are
      // bounced to /forms.
      if (path.startsWith("/admin")) {
        // /admin/users was replaced by the position-based org tree.
        if (path === "/admin/users" || path.startsWith("/admin/users/")) return redirectTo("/admin/org");

        if (role === "EMPLOYEE") return redirectTo("/forms");

        // Managing ADMIN accounts/permissions is never delegated — always
        // exactly SUPER_ADMIN, regardless of what permissions an ADMIN holds.
        if (path.startsWith("/admin/admins") && role !== "SUPER_ADMIN") return redirectTo("/admin");

        const isPermissionGated =
          path.startsWith("/admin/builder") ||
          path.startsWith("/admin/org") ||
          path.startsWith("/admin/filters") ||
          path.startsWith("/admin/analytics");

        // Coarse gate only — Super Admin and Admin both pass here. Each page's
        // own requirePermission() call does the real per-permission check
        // server-side, so this can't be bypassed by getting past this line.
        if (isPermissionGated && role !== "SUPER_ADMIN" && role !== "ADMIN") return redirectTo("/admin");
      }
    }
  }

  return supabaseResponse;
}
