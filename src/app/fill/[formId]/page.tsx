import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { DynamicFormRenderer } from "@/components/forms/dynamic-form-renderer";
import type { FormDefinition } from "@/types";

export const dynamic = "force-dynamic";

export default async function FillFormPage({
  params,
}: {
  params: Promise<{ formId: string }>;
}) {
  const { formId } = await params;
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: form }, { data: assignedNode }] = await Promise.all([
    supabase.from("forms").select("*").eq("id", formId).eq("is_active", true).single(),
    supabase.from("org_nodes").select("id").eq("assigned_profile_id", profile.id).eq("is_active", true).maybeSingle(),
  ]);

  if (!form) notFound();

  return (
    <AppShell profile={profile}>
      <DynamicFormRenderer
        form={form as FormDefinition}
        userId={profile.id}
        hasOrgNodeAssignment={Boolean(assignedNode)}
      />
    </AppShell>
  );
}
