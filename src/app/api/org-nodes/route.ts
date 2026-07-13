import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { orgNodeSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";

// Super Admin always passes; an Admin passes only with manage_org_chart.
// RLS on org_nodes (0007_admin_permissions.sql) enforces the same rule again
// at the data layer — this is just the fast, explicit application-level gate.
async function requireOrgChartAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role === "SUPER_ADMIN") return { supabase, user };
  if (caller?.role === "ADMIN") {
    const { data: perm } = await supabase
      .from("admin_permissions")
      .select("permission")
      .eq("profile_id", user.id)
      .eq("permission", "manage_org_chart")
      .maybeSingle();
    if (perm) return { supabase, user };
  }
  return null;
}

export async function POST(request: Request) {
  if (!rateLimit(`org-nodes:create:${getClientIp(request)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireOrgChartAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = orgNodeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { title, parent_id, assigned_profile_id } = parsed.data;

  const { data, error } = await caller.supabase
    .from("org_nodes")
    .insert({
      title,
      parent_id: parent_id || null,
      assigned_profile_id: assigned_profile_id || null,
    })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data, { status: 201 });
}
