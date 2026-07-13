import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { MySubmissionsContent } from "@/components/dashboard/my-submissions-content";
import type { Department, FormSubmissionWithRelations, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function MySubmissionsPage() {
  const profile = await requireRole(["EMPLOYEE"]);
  const supabase = await createClient();

  const [{ data: department }, { data: submissions }, { data: approverProfiles }, { data: orgNodeRows }] =
    await Promise.all([
      profile.department_id
        ? supabase.from("departments").select("*").eq("id", profile.department_id).single()
        : Promise.resolve({ data: null as Department | null }),
      supabase
        .from("form_submissions")
        .select(
          "*, form:forms(id,title,title_ar,fields), submitter:profiles!form_submissions_submitted_by_fkey(id,name,name_ar,email), department:departments(id,name,name_ar)"
        )
        .eq("submitted_by", profile.id)
        .order("created_at", { ascending: false }),
      // Directory used to resolve "Approved by" names. Not filtered on
      // is_active — an approver may be deactivated after approving something.
      supabase.from("profiles").select("id, name, name_ar").eq("role", "DEPARTMENT_HEAD"),
      // Used to resolve the submitter's/approvers' position + section for the
      // PDF export — same lookup the header profile chip does.
      supabase.from("org_nodes").select("id, title, parent_id, assigned_profile_id").eq("is_active", true),
    ]);

  const approvers = ((approverProfiles ?? []) as Profile[]).map((p) => ({
    id: p.id,
    name: p.name,
    name_ar: p.name_ar,
  }));

  return (
    <AppShell profile={profile} departmentName={department ? (department as Department).name : null}>
      <MySubmissionsContent
        submissions={(submissions ?? []) as unknown as FormSubmissionWithRelations[]}
        approvers={approvers}
        orgNodes={orgNodeRows ?? []}
      />
    </AppShell>
  );
}
