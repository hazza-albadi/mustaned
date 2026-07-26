import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { signupRequestSchema } from "@/lib/validations";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { createSignupUser } from "@/lib/create-signup-user";

// Public, unauthenticated — the app's only account-creation surface that
// doesn't require an existing admin session, so it gets the tightest rate
// limit of any account-creation route (others are 10-30/60s; this one is
// 5/60s per IP).
export async function POST(request: Request) {
  if (!(await rateLimitAsync(`signups:create:${getClientIp(request)}`, 5, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = signupRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { civil_id, email, password } = parsed.data;

  const admin = createAdminClient();

  // Two parameterized lookups rather than a single `.or(...)` filter string
  // built from user input — email isn't restrictive enough to rule out
  // characters (commas, parens) that PostgREST's filter syntax treats
  // specially, so interpolating it into a raw filter string would be an
  // injection risk.
  const [{ data: byCivilId }, { data: byEmail }] = await Promise.all([
    admin.from("profiles").select("account_status").eq("civil_id", civil_id).maybeSingle(),
    admin.from("profiles").select("account_status").eq("email", email).maybeSingle(),
  ]);
  const existing = byCivilId ?? byEmail;

  if (existing) {
    const message =
      existing.account_status === "PENDING"
        ? "A sign-up request with this Civil ID or email is already pending review"
        : existing.account_status === "REJECTED"
          ? "This sign-up request was previously rejected. Contact an administrator."
          : "An account with this Civil ID or email already exists";
    return NextResponse.json({ error: message }, { status: 409 });
  }

  const { data: created, error } = await createSignupUser({ civil_id, email, password });
  if (error || !created.user) {
    return NextResponse.json({ error: error?.message ?? "Failed to create sign-up request" }, { status: 400 });
  }

  return NextResponse.json({ id: created.user.id }, { status: 201 });
}
