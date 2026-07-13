import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { FormsList } from "@/components/builder/forms-list";
import type { FormDefinition } from "@/types";

export const dynamic = "force-dynamic";

export default async function BuilderListPage() {
  const { profile, permissions } = await requirePermission("manage_forms");
  const supabase = await createClient();

  const { data: forms } = await supabase
    .from("forms")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <AppShell profile={profile} departmentName={null} permissions={permissions}>
      <FormsList forms={(forms ?? []) as FormDefinition[]} />
    </AppShell>
  );
}
