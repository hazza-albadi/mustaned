import { requirePermission } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { DepartmentsTable } from "@/components/departments/departments-table";
import type { Department, Profile } from "@/types";

export const dynamic = "force-dynamic";

export default async function DepartmentsPage() {
  const { profile, permissions } = await requirePermission("manage_departments");
  const supabase = await createClient();

  const [{ data: departments }, { data: profiles }] = await Promise.all([
    supabase.from("departments").select("*").eq("is_active", true).order("name"),
    supabase.from("profiles").select("*"),
  ]);

  return (
    <AppShell profile={profile} departmentName={null} permissions={permissions}>
      <DepartmentsTable
        departments={(departments ?? []) as Department[]}
        profiles={(profiles ?? []) as Profile[]}
      />
    </AppShell>
  );
}
