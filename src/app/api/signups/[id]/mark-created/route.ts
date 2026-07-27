import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Same gate as approve/reject — see approve/route.ts's comment for why this
// is approve_signups rather than a dedicated permission. Creating the
// directory account is IT's own out-of-band process; this route only
// records that it happened, so it's the same reviewing-admin workflow as
// approve/reject, not a distinct capability that needs its own boundary.
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

// The only route that ever sets account_status to ACTIVE for a self-service
// sign-up. Deliberately does not touch Active Directory / Entra itself —
// Mustanad has no directory write access and isn't getting any (see
// TODO(directory-integration) in src/lib/verification/directory.ts). This
// just records that IT already created the account elsewhere, using the
// copy-ready values shown on the handoff view.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await rateLimitAsync(`signups:mark-created:${getClientIp(request)}`, 30, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireApproveSignupsAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("account_status").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Sign-up request not found" }, { status: 404 });
  if (target.account_status !== "APPROVED_AWAITING_DIRECTORY") {
    return NextResponse.json({ error: "This request is not awaiting directory account creation" }, { status: 409 });
  }

  const { error } = await admin
    .from("profiles")
    .update({ account_status: "ACTIVE", is_active: true })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
