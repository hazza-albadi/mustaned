import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ROLE_HOME, resolveAdminHome } from "@/lib/roles";
import type { AdminPermission, Profile } from "@/types";

const PROFILE_HEADER = "x-forwarded-profile";

export async function getCurrentProfile(): Promise<Profile | null> {
  // Perf fast-path: middleware (src/lib/supabase/middleware.ts) already ran
  // auth.getUser() + a profiles select for this exact request and forwards
  // the result via this header — reusing it here skips two more Supabase
  // network round trips per page load. The header is always freshly
  // overwritten by middleware itself (never merged with client-sent
  // headers), so it can't be spoofed by a client, and middleware unconditionally
  // gates every path that reaches a page component (see its matcher config),
  // so this is never a substitute for a real check, only a cache of one that
  // already happened. Any path middleware doesn't forward it for falls
  // straight through to the original DB round-trip below.
  const headerValue = (await headers()).get(PROFILE_HEADER);
  if (headerValue) {
    try {
      return JSON.parse(decodeURIComponent(headerValue)) as Profile;
    } catch {
      // Malformed header (shouldn't happen since we control the writer) —
      // fall through to the authoritative query instead of trusting it.
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

export async function requireProfile(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

// IMPORTANT — do not add a loading.tsx to any route segment whose page calls
// requireRole()/requirePermission() (or anything else that can call
// redirect()). A segment's loading.tsx wraps its page (and children) in an
// automatic <Suspense>, and Next.js commits the HTTP response as 200 and
// starts streaming the fallback the moment it decides the page is taking
// "too long" — if that happens before this function's redirect() throws,
// the status code is already locked in and the redirect degrades into an
// in-stream client-side navigation hint (requires JS to actually navigate)
// instead of a real 3xx. This bit us for real on requirePermission(), whose
// extra getAdminPermissions() round trip made it slow enough to reliably
// lose the race — see the loading.tsx removals under src/app/admin/ in git
// history for the incident. requireRole() usually resolves fast enough via
// getCurrentProfile()'s cached-header fast path to avoid the race today, but
// that's circumstantial timing, not a structural guarantee — any future
// change that adds a DB round trip before its redirect() (or just enough
// latency on a slower connection) could reintroduce the exact same bug here.
// If a loading skeleton is ever wanted for one of these pages again, wrap
// only the data-dependent JSX in a manual <Suspense> placed AFTER the
// role/permission check has already resolved — never rely on the file-based
// loading.tsx convention at the same or an ancestor segment.
export async function requireRole(roles: Profile["role"][]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect(ROLE_HOME[profile.role]);
  return profile;
}

export async function getAdminPermissions(profileId: string): Promise<AdminPermission[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("admin_permissions").select("permission").eq("profile_id", profileId);
  return (data ?? []).map((row) => row.permission);
}

// Gate for the permission-mapped /admin pages (builder, org, filters,
// analytics, signups). SUPER_ADMIN always passes. An ADMIN passes only
// if they hold the specific permission; otherwise they're sent to whichever
// admin page they *do* have access to (or the no-access page), never back to
// a page that will just redirect them again. See the loading.tsx warning
// above requireRole() — it applies here too, doubly so, since the extra
// getAdminPermissions() round trip below is exactly what made this function
// lose the redirect-vs-Suspense-streaming race in practice.
export async function requirePermission(
  permission: AdminPermission
): Promise<{ profile: Profile; permissions: AdminPermission[] }> {
  const profile = await requireProfile();
  if (profile.role === "SUPER_ADMIN") return { profile, permissions: [] };
  if (profile.role !== "ADMIN") redirect(ROLE_HOME[profile.role]);

  const permissions = await getAdminPermissions(profile.id);
  if (!permissions.includes(permission)) redirect(resolveAdminHome(permissions));
  return { profile, permissions };
}
