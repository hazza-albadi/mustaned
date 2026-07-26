import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Same gate as the approve route — see its comment for why this is
// approve_signups rather than manage_org_chart.
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
  if (!(await rateLimitAsync(`signups:reject:${getClientIp(request)}`, 30, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireApproveSignupsAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const admin = createAdminClient();

  const { data: target } = await admin.from("profiles").select("account_status").eq("id", id).maybeSingle();
  if (!target) return NextResponse.json({ error: "Sign-up request not found" }, { status: 404 });
  if (target.account_status !== "PENDING") {
    return NextResponse.json({ error: "This request has already been reviewed" }, { status: 409 });
  }

  // Deliberately does not ban the auth user (supabase.auth.admin does support
  // this) — banning would make signInWithPassword itself fail with a generic
  // Supabase auth error, which would prevent showing the specific "sign-up
  // not approved" message the login form gives instead. Sign-in is allowed
  // to succeed; the login form reads account_status right after and signs
  // the session back out (see login-form.tsx), while RLS (auth_is_approved(),
  // 0013_signup_requests.sql) blocks any real data access regardless of how
  // the session was obtained.
  const { error } = await admin.from("profiles").update({ account_status: "REJECTED" }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
