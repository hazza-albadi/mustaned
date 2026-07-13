import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { userSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Super Admin always passes; an Admin passes only with manage_org_chart. This
// route uses the service-role client for auth.admin.*/profiles writes, which
// bypasses RLS entirely — the target-role checks in each handler below (not
// RLS) are the real guarantee that an Admin can only touch Department
// Head/Employee accounts, never another Admin or Super Admin.
async function requireOrgChartAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role === "SUPER_ADMIN") return { user, isSuperAdmin: true };
  if (caller?.role === "ADMIN") {
    const { data: perm } = await supabase
      .from("admin_permissions")
      .select("permission")
      .eq("profile_id", user.id)
      .eq("permission", "manage_org_chart")
      .maybeSingle();
    if (perm) return { user, isSuperAdmin: false };
  }
  return null;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!rateLimit(`users:update:${getClientIp(request)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireOrgChartAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = userSchema.partial({ password: true, email: true }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { name, name_ar, email, role, department_id, password } = parsed.data;

  if (!caller.isSuperAdmin) {
    const { data: target } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
    const targetOk = target && (target.role === "DEPARTMENT_HEAD" || target.role === "EMPLOYEE");
    const newRoleOk = role === "DEPARTMENT_HEAD" || role === "EMPLOYEE";
    if (!targetOk || !newRoleOk) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (email) {
    const { error: emailError } = await admin.auth.admin.updateUserById(id, { email });
    if (emailError) {
      return NextResponse.json({ error: emailError.message }, { status: 400 });
    }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ name, name_ar, ...(email ? { email } : {}), role, department_id: department_id ?? null })
    .eq("id", id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (password) {
    await admin.auth.admin.updateUserById(id, { password });
  }

  if (role === "DEPARTMENT_HEAD" && department_id) {
    await admin.from("departments").update({ head_id: id }).eq("id", department_id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!rateLimit(`users:delete:${getClientIp(request)}`, 20, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireOrgChartAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  if (id === caller.user.id) {
    return NextResponse.json({ error: "You cannot delete your own account" }, { status: 400 });
  }

  const admin = createAdminClient();

  if (!caller.isSuperAdmin) {
    const { data: target } = await admin.from("profiles").select("role").eq("id", id).maybeSingle();
    if (!target || (target.role !== "DEPARTMENT_HEAD" && target.role !== "EMPLOYEE")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
