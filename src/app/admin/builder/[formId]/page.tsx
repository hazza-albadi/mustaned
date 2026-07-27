import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAllOrgNodes } from "@/lib/org-nodes-cache";
import { AppShell } from "@/components/nav/app-shell";
import { FormBuilder } from "@/components/builder/form-builder";
import type { Filter, FormDefinition } from "@/types";

export const dynamic = "force-dynamic";

export default async function BuilderEditPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const { profile, permissions } = await requirePermission("manage_forms");
  const supabase = await createClient();

  const [allOrgNodes, { data: filters }] = await Promise.all([
    getAllOrgNodes(),
    supabase.from("filters").select("*").eq("is_active", true).order("name"),
  ]);
  const orgNodes = allOrgNodes.filter((n) => n.is_active).sort((a, b) => a.title.localeCompare(b.title));

  let initialForm: FormDefinition | null = null;

  if (formId !== "new") {
    const { data: form } = await supabase.from("forms").select("*").eq("id", formId).single();
    if (!form) notFound();
    initialForm = form as FormDefinition;
  }

  return (
    <AppShell profile={profile} permissions={permissions}>
      <FormBuilder
        initialForm={initialForm}
        orgNodes={orgNodes}
        filters={(filters ?? []) as Filter[]}
        userId={profile.id}
      />
    </AppShell>
  );
}
