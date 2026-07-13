import { requireRole } from "@/lib/auth";
import { AppShell } from "@/components/nav/app-shell";
import { NoAccessMessage } from "@/components/admin-accounts/no-access-message";

export const dynamic = "force-dynamic";

// Landing spot for an Admin account that currently holds zero permissions —
// avoids a redirect loop back through requirePermission()/resolveAdminHome().
export default async function AdminNoAccessPage() {
  const profile = await requireRole(["ADMIN"]);

  return (
    <AppShell profile={profile} departmentName={null} permissions={[]}>
      <NoAccessMessage />
    </AppShell>
  );
}
