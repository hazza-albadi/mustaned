import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { AdminAccountsTable } from "@/components/admin-accounts/admin-accounts-table";
import type { AdminPermission, AdminPermissionRow, Profile } from "@/types";

export const dynamic = "force-dynamic";

// Deliberately requireRole(["SUPER_ADMIN"]) rather than requirePermission() —
// managing Admin accounts/permissions is never itself a grantable permission.
export default async function AdminAccountsPage() {
  const profile = await requireRole(["SUPER_ADMIN"]);
  const supabase = await createClient();

  const [{ data: admins }, { data: permissionRows }] = await Promise.all([
    supabase.from("profiles").select("*").eq("role", "ADMIN").order("name"),
    supabase.from("admin_permissions").select("*"),
  ]);

  const permissionsByAdmin: Record<string, AdminPermission[]> = {};
  for (const row of (permissionRows ?? []) as AdminPermissionRow[]) {
    (permissionsByAdmin[row.profile_id] ??= []).push(row.permission);
  }

  return (
    <AppShell profile={profile}>
      <AdminAccountsTable admins={(admins ?? []) as Profile[]} permissionsByAdmin={permissionsByAdmin} />
    </AppShell>
  );
}
