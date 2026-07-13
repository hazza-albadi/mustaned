import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { userSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { createAuthUser } from "@/lib/create-auth-user";

export async function POST(request: Request) {
  if (!rateLimit(`users:create:${getClientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const isSuperAdmin = caller?.role === "SUPER_ADMIN";
  let isAdminWithOrgChart = false;
  if (!isSuperAdmin && caller?.role === "ADMIN") {
    const { data: perm } = await supabase
      .from("admin_permissions")
      .select("permission")
      .eq("profile_id", user.id)
      .eq("permission", "manage_org_chart")
      .maybeSingle();
    isAdminWithOrgChart = Boolean(perm);
  }
  if (!isSuperAdmin && !isAdminWithOrgChart) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = userSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, name_ar, email, role, department_id, password } = parsed.data;

  // An Admin (as opposed to a Super Admin) may only create Department Head
  // or Employee accounts through this route — never another Admin or Super
  // Admin, even with manage_org_chart. This is the real enforcement: the
  // matching profiles RLS check can't apply here since account creation goes
  // through the service-role client via createAuthUser().
  if (!isSuperAdmin && role !== "DEPARTMENT_HEAD" && role !== "EMPLOYEE") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: created, error } = await createAuthUser({
    email,
    password,
    metadata: { name, name_ar, role, department_id },
  });

  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? "Failed to create user" }, { status: 400 });
  }

  if (role === "DEPARTMENT_HEAD" && department_id) {
    const admin = createAdminClient();
    await admin.from("departments").update({ head_id: created.user.id }).eq("id", department_id);
  }

  return NextResponse.json({ id: created.user.id }, { status: 201 });
}
