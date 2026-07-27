import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAllOrgNodes } from "@/lib/org-nodes-cache";
import { AppShell } from "@/components/nav/app-shell";
import { AnalyticsContent } from "@/components/analytics/analytics-content";
import type { FormDefinition, FormSubmissionWithRelations, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const { profile, permissions } = await requirePermission("view_analytics");
  const supabase = await createClient();

  const [{ data: forms }, { data: submissions }, { data: allProfiles }, allOrgNodes] = await Promise.all([
    supabase.from("forms").select("*"),
    supabase
      .from("form_submissions")
      .select(
        "*, form:forms(id,title,title_ar), submitter:profiles!form_submissions_submitted_by_fkey(id,name,name_ar,email)"
      ),
    // Full directory (not role-filtered) so the approval-steps export can
    // resolve names for any approver, including org-node-only employees.
    supabase.from("profiles").select("id, name, name_ar"),
    // Used to resolve each approver's position + section — same lookup the
    // profile chip and PDF export use.
    getAllOrgNodes(),
  ]);
  const orgNodeRows = allOrgNodes
    .filter((n) => n.is_active)
    .map(({ id, title, parent_id, assigned_profile_id }) => ({ id, title, parent_id, assigned_profile_id }));

  return (
    <AppShell profile={profile} permissions={permissions}>
      <AnalyticsContent
        forms={(forms ?? []) as FormDefinition[]}
        submissions={(submissions ?? []) as unknown as FormSubmissionWithRelations[]}
        profiles={(allProfiles ?? []) as Pick<Profile, "id" | "name" | "name_ar">[]}
        orgNodes={orgNodeRows}
      />
    </AppShell>
  );
}
