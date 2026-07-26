import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { SignupRequestsTable } from "@/components/signups/signup-requests-table";
import type { OrgNode, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function SignupsPage() {
  const { profile, permissions } = await requirePermission("approve_signups");
  const supabase = await createClient();

  const [{ data: requests }, { data: nodes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .neq("account_status", "ACTIVE")
      .order("created_at", { ascending: false }),
    supabase.from("org_nodes").select("*").eq("is_active", true).order("title"),
  ]);

  return (
    <AppShell profile={profile} permissions={permissions}>
      <SignupRequestsTable
        requests={(requests ?? []) as Profile[]}
        vacantNodes={(nodes ?? []).filter((n) => !n.assigned_profile_id) as OrgNode[]}
      />
    </AppShell>
  );
}
