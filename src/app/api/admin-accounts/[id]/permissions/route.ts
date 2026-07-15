import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { adminPermissionsUpdateSchema } from "@/lib/validations";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  return caller?.role === "SUPER_ADMIN" ? { supabase, user } : null;
}

// Replaces the full permission set for an Admin account (add + revoke in one
// call) rather than a piecemeal add/remove API.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await rateLimitAsync(`admin-accounts:permissions:${getClientIp(request)}`, 30, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireSuperAdmin();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = adminPermissionsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data: target } = await caller.supabase.from("profiles").select("id, role").eq("id", id).maybeSingle();
  if (!target || target.role !== "ADMIN") {
    return NextResponse.json({ error: "Not an admin account" }, { status: 400 });
  }

  const { error: deleteError } = await caller.supabase.from("admin_permissions").delete().eq("profile_id", id);
  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  if (parsed.data.permissions.length > 0) {
    const { error: insertError } = await caller.supabase.from("admin_permissions").insert(
      parsed.data.permissions.map((permission) => ({
        profile_id: id,
        permission,
        granted_by: caller.user.id,
      }))
    );
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ ok: true });
}
