import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { FormBuilder } from "@/components/builder/form-builder";
import type { Department, FormDefinition, OrgNode } from "@/types";

export const dynamic = "force-dynamic";

export default async function BuilderEditPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const { profile, permissions } = await requirePermission("manage_forms");
  const supabase = await createClient();

  const [{ data: departments }, { data: orgNodes }] = await Promise.all([
    supabase.from("departments").select("*").eq("is_active", true).order("name"),
    supabase.from("org_nodes").select("*").eq("is_active", true).order("title"),
  ]);

  let initialForm: FormDefinition | null = null;

  if (formId !== "new") {
    const { data: form } = await supabase.from("forms").select("*").eq("id", formId).single();
    if (!form) notFound();
    initialForm = form as FormDefinition;
  }

  return (
    <AppShell profile={profile} departmentName={null} permissions={permissions}>
      <FormBuilder
        initialForm={initialForm}
        departments={(departments ?? []) as Department[]}
        orgNodes={(orgNodes ?? []) as OrgNode[]}
        userId={profile.id}
      />
    </AppShell>
  );
}
