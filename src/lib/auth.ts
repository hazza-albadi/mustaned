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

// Gate for the four permission-mapped /admin pages (builder, org, filters,
// analytics). SUPER_ADMIN always passes. An ADMIN passes only
// if they hold the specific permission; otherwise they're sent to whichever
// admin page they *do* have access to (or the no-access page), never back to
// a page that will just redirect them again.
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
