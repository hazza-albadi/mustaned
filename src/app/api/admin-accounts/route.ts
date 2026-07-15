import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminAccount } from "@/lib/create-admin-account";
import { adminAccountSchema } from "@/lib/validations";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Always exactly SUPER_ADMIN — creating Admin accounts is never delegated,
// so there's no ADMIN/permission branch here at all, unlike the org-chart
// routes.
async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return caller?.role === "SUPER_ADMIN" ? { supabase, user } : null;
}

export async function POST(request: Request) {
  if (!(await rateLimitAsync(`admin-accounts:create:${getClientIp(request)}`, 10, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireSuperAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = adminAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { name, name_ar, email, password, permissions } = parsed.data;

  const { data: created, error } = await createAdminAccount({ name, name_ar, email, password });
  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? "Failed to create admin account" }, { status: 400 });
  }

  if (permissions.length > 0) {
    const { error: permError } = await caller.supabase.from("admin_permissions").insert(
      permissions.map((permission) => ({
        profile_id: created.user!.id,
        permission,
        granted_by: caller.user.id,
      }))
    );
    if (permError) {
      return NextResponse.json({ error: permError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ id: created.user.id }, { status: 201 });
}
