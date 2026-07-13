import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { OrgTreeContent } from "@/components/org/org-tree-content";
import type { FormDefinition, OrgNode, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function OrgPage() {
  const { profile, permissions } = await requirePermission("manage_org_chart");
  const supabase = await createClient();

  const [{ data: nodes }, { data: profiles }, { data: forms }] = await Promise.all([
    supabase.from("org_nodes").select("*").order("created_at", { ascending: true }),
    supabase.from("profiles").select("*").eq("is_active", true).order("name"),
    supabase.from("forms").select("id, title, approval_chain"),
  ]);

  return (
    <AppShell profile={profile} departmentName={null} permissions={permissions}>
      <OrgTreeContent
        nodes={(nodes ?? []) as OrgNode[]}
        profiles={(profiles ?? []) as Profile[]}
        forms={(forms ?? []) as Pick<FormDefinition, "id" | "title" | "approval_chain">[]}
      />
    </AppShell>
  );
}
