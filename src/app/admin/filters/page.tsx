import { requirePermission } from "@/lib/auth";
import { getActiveFilters } from "@/lib/forms-filters-cache";
import { AppShell } from "@/components/nav/app-shell";
import { FiltersTable } from "@/components/filters/filters-table";

export const dynamic = "force-dynamic";

export default async function FiltersPage() {
  const { profile, permissions } = await requirePermission("manage_filters");

  const filters = await getActiveFilters();

  return (
    <AppShell profile={profile} permissions={permissions}>
      <FiltersTable filters={filters} />
    </AppShell>
  );
}
