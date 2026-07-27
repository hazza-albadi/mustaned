import { requirePermission } from "@/lib/auth";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { SignupRequestsTable } from "@/components/signups/signup-requests-table";
import { DirectoryHandoffTable } from "@/components/signups/directory-handoff-table";
import type { OrgNode, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function SignupsPage() {
  const { profile, permissions } = await requirePermission("approve_signups");
  const supabase = await createClient();

  // All org nodes (not just vacant ones) are needed here: the handoff table
  // resolves each approved requester's assigned position via
  // resolveOrgPosition(), which needs to find the node they were placed
  // into, not just the still-empty ones. Vacant filtering for the approve
  // dialog's picker happens below, in memory.
  const [{ data: requests }, { data: nodes }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .neq("account_status", "ACTIVE")
      .order("created_at", { ascending: false }),
    supabase.from("org_nodes").select("*").order("title"),
  ]);

  const allRequests = (requests ?? []) as Profile[];
  const allNodes = (nodes ?? []) as OrgNode[];
  const vacantNodes = allNodes.filter((n) => n.is_active && !n.assigned_profile_id);

  const approverIds = Array.from(
    new Set(allRequests.map((r) => r.approved_by).filter((id): id is string => Boolean(id)))
  );
  // Service-role read, deliberately: the reviewing admin's own session may
  // only have RLS visibility into non-ACTIVE profiles ("Admins with
  // approve_signups can view pending profiles", 0013_signup_requests.sql).
  // An approver is by definition an ACTIVE admin/super admin, which a plain
  // ADMIN holding only approve_signups has no other policy granting
  // visibility into. This page is already gated by requirePermission()
  // above, so this is a display-only name lookup, not a new access boundary.
  const { data: approvers } =
    approverIds.length > 0
      ? await createAdminClient().from("profiles").select("id, name, name_ar").in("id", approverIds)
      : { data: [] };

  return (
    <AppShell profile={profile} permissions={permissions}>
      <div className="space-y-10">
        <SignupRequestsTable requests={allRequests} vacantNodes={vacantNodes} />
        <DirectoryHandoffTable requests={allRequests} nodes={allNodes} approvers={approvers ?? []} />
      </div>
    </AppShell>
  );
}
