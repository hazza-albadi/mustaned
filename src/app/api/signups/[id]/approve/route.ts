import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { signupApprovalSchema } from "@/lib/validations";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Super Admin always passes; an Admin passes only with approve_signups.
// Deliberately NOT manage_org_chart, even though this route can also write
// org_nodes.assigned_profile_id below — reviewing sign-ups and placing a
// newly-approved person on the chart happen as one action here (per product
// decision), so the service-role client is used for both writes and this
// app-layer check is the real gate, the same cross-boundary-privileged-route
// pattern /api/users and /api/users/[id] already use for their own writes.
async function requireApproveSignupsAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role === "SUPER_ADMIN") return { user };
  if (caller?.role === "ADMIN") {
    const { data: perm } = await supabase
      .from("admin_permissions")
      .select("permission")
      .eq("profile_id", user.id)
      .eq("permission", "approve_signups")
      .maybeSingle();
    if (perm) return { user };
  }
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await rateLimitAsync(`signups:approve:${getClientIp(request)}`, 30, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireApproveSignupsAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const parsed = signupApprovalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { node_id } = parsed.data;

  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("id, account_status").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Sign-up request not found" }, { status: 404 });
  if (target.account_status !== "PENDING") {
    return NextResponse.json({ error: "This request has already been reviewed" }, { status: 409 });
  }

  // TODO(kawader-integration): auto-match civil_id against Kawader API and
  // auto-assign org_node instead of manual admin approval — this whole
  // node_id picker (and the role-derivation rule below) goes away once that
  // lands, replaced by an automatic lookup.
  let role: "EMPLOYEE" | "DEPARTMENT_HEAD" = "EMPLOYEE";

  if (node_id) {
    const { data: node } = await admin
      .from("org_nodes")
      .select("id, is_active, assigned_profile_id")
      .eq("id", node_id)
      .maybeSingle();
    if (!node || !node.is_active) {
      return NextResponse.json({ error: "Position not found" }, { status: 404 });
    }
    if (node.assigned_profile_id) {
      return NextResponse.json({ error: "This position is already filled" }, { status: 409 });
    }

    // Mirrors resolveAssignedProfileId's rule in src/lib/assign-person.ts: a
    // position with active subordinates needs approver access.
    const { count } = await admin
      .from("org_nodes")
      .select("id", { count: "exact", head: true })
      .eq("parent_id", node_id)
      .eq("is_active", true);
    role = (count ?? 0) > 0 ? "DEPARTMENT_HEAD" : "EMPLOYEE";
  }

  // Approval no longer activates the account directly — it moves the
  // request into APPROVED_AWAITING_DIRECTORY, where it stays (is_active
  // still false, so auth_is_approved() keeps blocking real access exactly
  // like it does for PENDING) until IT creates the actual directory account
  // and an admin marks it done via POST /api/signups/[id]/mark-created,
  // which is the only thing that flips is_active/account_status to ACTIVE.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      account_status: "APPROVED_AWAITING_DIRECTORY",
      role,
      approved_by: caller.user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (node_id) {
    const { error: nodeError } = await admin
      .from("org_nodes")
      .update({ assigned_profile_id: id })
      .eq("id", node_id);
    if (nodeError) {
      // The profile is already correctly approved at this point — a failed
      // placement just leaves them APPROVED_AWAITING_DIRECTORY-but-unassigned,
      // exactly like any other newly-approved account for whom the admin
      // skipped node_id. They can still be placed normally afterward via the
      // Org Chart page.
      // Returned as a 200 + `warning` (not `error`) so the client's generic
      // `if (!res.ok) throw` success/failure convention still reports this
      // as a completed approval, just with a surfaced caveat.
      return NextResponse.json({ ok: true, warning: `Approved, but failed to assign position: ${nodeError.message}` });
    }
    // Keeps getAllOrgNodes()'s cache (src/lib/org-nodes-cache.ts) from
    // showing this position as still vacant.
    revalidateTag("org-nodes");
  }

  return NextResponse.json({ ok: true });
}
