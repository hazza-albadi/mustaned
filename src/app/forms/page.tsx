import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { FormsContent } from "@/components/forms/forms-content";

export const dynamic = "force-dynamic";

export default async function FormsPage() {
  const profile = await requireRole(["EMPLOYEE", "DEPARTMENT_HEAD"]);
  const supabase = await createClient();

  const { data: forms } = await supabase
    .from("forms")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  return (
    <AppShell profile={profile}>
      <FormsContent forms={forms ?? []} />
    </AppShell>
  );
}
