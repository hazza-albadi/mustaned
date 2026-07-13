import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { DynamicFormRenderer } from "@/components/forms/dynamic-form-renderer";
import type { Department, FormDefinition } from "@/types";

export const dynamic = "force-dynamic";

export default async function FillFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: form }, { data: myDepartment }, { data: assignedNode }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", formId).eq("is_active", true).single(),
    profile.department_id
      ? supabase.from("departments").select("*").eq("id", profile.department_id).single()
      : Promise.resolve({ data: null as Department | null }),
    // department_id is legacy scaffolding — an employee holding an org-tree
    // position needs no department assignment to submit; routing resolves
    // through approval_chain / org_nodes instead.
    supabase.from("org_nodes").select("id").eq("assigned_profile_id", profile.id).eq("is_active", true).maybeSingle(),
  ]);

  if (!form) notFound();

  return (
    <AppShell profile={profile} departmentName={myDepartment ? (myDepartment as Department).name : null}>
      <DynamicFormRenderer
        form={form as FormDefinition}
        userId={profile.id}
        employeeDepartmentId={profile.department_id}
        hasOrgNodeAssignment={Boolean(assignedNode)}
      />
    </AppShell>
  );
}
