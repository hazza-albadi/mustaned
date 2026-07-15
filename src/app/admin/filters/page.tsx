import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { FiltersTable } from "@/components/filters/filters-table";
import type { Filter } from "@/types";

export const dynamic = "force-dynamic";

export default async function FiltersPage() {
  const { profile, permissions } = await requirePermission("manage_filters");
  const supabase = await createClient();

  const { data: filters } = await supabase.from("filters").select("*").eq("is_active", true).order("name");

  return (
    <AppShell profile={profile} permissions={permissions}>
      <FiltersTable filters={(filters ?? []) as Filter[]} />
    </AppShell>
  );
}
