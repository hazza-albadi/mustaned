import { redirect } from "next/navigation";
import { requireProfile, getAdminPermissions } from "@/lib/auth";
import { ROLE_HOME, resolveAdminHome } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { AdminContent } from "@/components/admin/admin-content";
import type { AdminPermission, FormSubmissionWithRelations, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const profile = await requireProfile();

  // Hybrid gate: Department Head (their approval queue) and Super Admin
  // (unrestricted) always pass; Admin only with the view_submissions
  // permission. Everyone else is bounced to their own home.
  let permissions: AdminPermission[] = [];
  if (profile.role === "ADMIN") {
    permissions = await getAdminPermissions(profile.id);
    if (!permissions.includes("view_submissions")) redirect(resolveAdminHome(permissions));
  } else if (profile.role !== "DEPARTMENT_HEAD" && profile.role !== "SUPER_ADMIN") {
    redirect(ROLE_HOME[profile.role]);
  }

  const supabase = await createClient();

  // RLS scopes this query automatically: department heads only see
  // submissions where they're a listed approver, Super Admin sees everything.
  const [{ data: submissions }, { data: approverProfiles }] = await Promise.all([
    supabase
      .from("form_submissions")
      .select(
        "*, form:forms(id,title,title_ar,fields), submitter:profiles!form_submissions_submitted_by_fkey(id,name,name_ar,email)"
      )
      .order("created_at", { ascending: false }),
    // Directory used to resolve "Approved by" names. Not filtered on
    // is_active — an approver may be deactivated after approving something.
    supabase.from("profiles").select("id, name, name_ar").eq("role", "DEPARTMENT_HEAD"),
  ]);

  const approvers = ((approverProfiles ?? []) as Profile[]).map((p) => ({
    id: p.id,
    name: p.name,
    name_ar: p.name_ar,
  }));

  return (
    <AppShell profile={profile} permissions={permissions}>
      <AdminContent
        submissions={(submissions ?? []) as unknown as FormSubmissionWithRelations[]}
        approverId={profile.id}
        approvers={approvers}
        role={profile.role}
      />
    </AppShell>
  );
}
