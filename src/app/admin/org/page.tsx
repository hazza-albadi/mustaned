import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getAllOrgNodes } from "@/lib/org-nodes-cache";
import { AppShell } from "@/components/nav/app-shell";
import { OrgTreeContent } from "@/components/org/org-tree-content";
import type { FormDefinition, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function OrgPage() {
  const { profile, permissions } = await requirePermission("manage_org_chart");
  const supabase = await createClient();

  const [nodes, { data: profiles }, { data: forms }] = await Promise.all([
    getAllOrgNodes(),
    supabase.from("profiles").select("*").eq("is_active", true).order("name"),
    supabase.from("forms").select("id, title, approval_chain"),
  ]);

  return (
    <AppShell profile={profile} permissions={permissions}>
      <OrgTreeContent
        nodes={nodes}
        profiles={(profiles ?? []) as Profile[]}
        forms={(forms ?? []) as Pick<FormDefinition, "id" | "title" | "approval_chain">[]}
      />
    </AppShell>
  );
}
