// Shared "assign a person to a position" resolution used by both the Add
// Position dialog and the node edit panel — either points at an existing
// unassigned profile, or creates a brand new one via the existing /api/users
// POST route (which provisions a Supabase auth user + profile row).
export type AssignPersonValue =
  | { mode: "none" }
  | { mode: "existing"; profileId: string }
  | { mode: "new"; name: string; email: string };

export type ResolvedAssignedProfile = { profileId: string | null; generatedPassword?: string };

export async function resolveAssignedProfileId(
  value: AssignPersonValue,
  // Whether the position being assigned has at least one active subordinate
  // position under it right now. Positions with reports need approver access
  // (Department Head); leaf positions are plain employees. A brand-new
  // position always passes false here — it has no children yet at creation
  // time, even if subordinates get added under it later.
  hasChildren: boolean
): Promise<ResolvedAssignedProfile> {
  if (value.mode === "none") return { profileId: null };
  if (value.mode === "existing") return { profileId: value.profileId || null };

  const res = await fetch("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: value.name,
      email: value.email,
      role: hasChildren ? "DEPARTMENT_HEAD" : "EMPLOYEE",
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? "Failed to create person");
  // S-02: no UI collects a password for this flow, so /api/users generates
  // a random one-time password and returns it here — the caller must show
  // it to whoever is creating the account, since it can never be recovered
  // afterwards (Supabase only stores the hash).
  return { profileId: body.id as string, generatedPassword: body.generatedPassword as string | undefined };
}
