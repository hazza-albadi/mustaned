import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { FormsContent } from "@/components/forms/forms-content";
import type { Department, FormDefinition } from "@/types";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const profile = await requireRole(["EMPLOYEE", "DEPARTMENT_HEAD"]);
  const supabase = await createClient();

  const [{ data: forms }, { data: department }] = await Promise.all([
    supabase
      .from("forms")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    profile.department_id
      ? supabase.from("departments").select("*").eq("id", profile.department_id).single()
      : Promise.resolve({ data: null as Department | null }),
  ]);

  const visibleForms = (forms ?? []).filter(
    (f: FormDefinition) =>
      !f.allowed_departments ||
      f.allowed_departments.length === 0 ||
      // allowed_departments is legacy (pre-org-tree) scoping — an employee
      // with no department_id has no way to satisfy it, so org-node-only
      // employees bypass it entirely rather than being silently excluded.
      !profile.department_id ||
      f.allowed_departments.includes(profile.department_id)
  );

  return (
    <AppShell profile={profile} departmentName={department ? (department as Department).name : null}>
      <FormsContent forms={visibleForms} />
    </AppShell>
  );
}
