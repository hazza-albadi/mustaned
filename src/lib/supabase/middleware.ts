import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ROLE_HOME } from "@/lib/roles";
import type { Role } from "@/types";

const PUBLIC_PATHS = ["/login", "/auth", "/_next", "/favicon.ico"];

export async function updateSession(request: NextRequest) {
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

  if (user && isGatedPath) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role as Role | undefined;

    if (!role) {
      return redirectTo("/forms");
    }

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

  return supabaseResponse;
}
