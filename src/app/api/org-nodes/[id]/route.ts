import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { orgNodeSchema } from "@/lib/validations";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import type { OrgNode } from "@/types";

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

// A node can never become its own ancestor — walk down from `nodeId` and make
// sure `candidateParentId` isn't the node itself or one of its descendants.
async function wouldCreateCycle(
  supabase: Awaited<ReturnType<typeof createClient>>,
  nodeId: string,
  candidateParentId: string
): Promise<boolean> {
  if (candidateParentId === nodeId) return true;

  const { data } = await supabase.from("org_nodes").select("id, parent_id");
  const rows = (data ?? []) as Pick<OrgNode, "id" | "parent_id">[];
  const childrenOf = new Map<string, string[]>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    childrenOf.set(row.parent_id, [...(childrenOf.get(row.parent_id) ?? []), row.id]);
  }

  const stack = [...(childrenOf.get(nodeId) ?? [])];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (current === candidateParentId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    stack.push(...(childrenOf.get(current) ?? []));
  }
  return false;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!rateLimit(`org-nodes:update:${getClientIp(request)}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireOrgChartAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = orgNodeSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const updates = parsed.data;

  if (updates.parent_id) {
    if (await wouldCreateCycle(caller.supabase, id, updates.parent_id)) {
      return NextResponse.json(
        { error: "Cannot move a position under itself or one of its own reports" },
        { status: 400 }
      );
    }
  }

  if (updates.assigned_profile_id) {
    const { data: holder } = await caller.supabase
      .from("org_nodes")
      .select("id")
      .eq("assigned_profile_id", updates.assigned_profile_id)
      .neq("id", id)
      .maybeSingle();
    if (holder) {
      return NextResponse.json({ error: "This person is already assigned to another position" }, { status: 409 });
    }
  }

  const { data, error } = await caller.supabase
    .from("org_nodes")
    .update({
      ...updates,
      parent_id: "parent_id" in updates ? updates.parent_id || null : undefined,
      assigned_profile_id:
        "assigned_profile_id" in updates ? updates.assigned_profile_id || null : undefined,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!rateLimit(`org-nodes:delete:${getClientIp(request)}`, 30, 60_000)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireOrgChartAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { error } = await caller.supabase.from("org_nodes").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
