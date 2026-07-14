import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import type { FormSubmissionWithRelations, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const profile = await requireRole(["DEPARTMENT_HEAD"]);
  const supabase = await createClient();

  const [{ data: submissions }, { data: approverProfiles }] = await Promise.all([
    supabase
      .from("form_submissions")
      .select(
        "*, form:forms(id,title,title_ar,fields), submitter:profiles!form_submissions_submitted_by_fkey(id,name,name_ar,email)"
      )
      .eq("submitted_by", profile.id)
      .order("created_at", { ascending: false }),
    // Directory used to resolve "Approved by" names. Not filtered on
    // is_active — an approver may be deactivated after approving something.
    supabase.from("profiles").select("id, name, name_ar").eq("role", "DEPARTMENT_HEAD"),
  ]);

  const subs = (submissions ?? []) as unknown as FormSubmissionWithRelations[];
  const stats = {
    total: subs.length,
    pending: subs.filter((s) => s.status === "PENDING").length,
    approved: subs.filter((s) => s.status === "APPROVED").length,
    rejected: subs.filter((s) => s.status === "REJECTED").length,
  };

  const approvers = ((approverProfiles ?? []) as Profile[]).map((p) => ({
    id: p.id,
    name: p.name,
    name_ar: p.name_ar,
  }));

  return (
    <AppShell profile={profile}>
      <DashboardContent submissions={subs} stats={stats} approvers={approvers} />
    </AppShell>
  );
}
