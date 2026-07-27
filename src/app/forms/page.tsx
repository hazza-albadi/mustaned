import { requireRole } from "@/lib/auth";
import { getActiveForms, getActiveFilters } from "@/lib/forms-filters-cache";
import { AppShell } from "@/components/nav/app-shell";
import { FormsContent } from "@/components/forms/forms-content";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const profile = await requireRole(["EMPLOYEE", "DEPARTMENT_HEAD"]);

  const [forms, filters] = await Promise.all([getActiveForms(), getActiveFilters()]);

  return (
    <AppShell profile={profile}>
      <FormsContent forms={forms} filters={filters} />
    </AppShell>
  );
}
