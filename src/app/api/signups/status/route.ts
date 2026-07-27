import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { statusLookupSchema } from "@/lib/validations";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import type { AccountStatus } from "@/types";

// Public, unauthenticated status check so a requester can follow up from any
// device without signing in (there's nothing to sign in with until their
// request is ACTIVE). Same 5/60s-per-IP limit as POST /api/signups — this is
// arguably more attractive to abuse (no account creation cost per attempt),
// so it must never be looser.
//
// S-anti-oracle: a Civil ID with no signup row and one that simply doesn't
// belong to anyone must be indistinguishable. This route only ever queries
// Mustanad's own `profiles` table (never Kawader), so "not found here" is
// all it can ever honestly mean — it structurally cannot leak whether a
// Civil ID belongs to a real employee. The response is a bare status key,
// never a name, email, approver, or timestamp.
export type SignupStatusLookupResult =
  | "not_found"
  | "pending"
  | "approved_awaiting_directory"
  | "rejected"
  | "active";

const STATUS_MAP: Record<AccountStatus, SignupStatusLookupResult> = {
  PENDING: "pending",
  APPROVED_AWAITING_DIRECTORY: "approved_awaiting_directory",
  REJECTED: "rejected",
  ACTIVE: "active",
};

export async function POST(request: Request) {
  if (!(await rateLimitAsync(`signups:status:${getClientIp(request)}`, 5, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  const parsed = statusLookupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("account_status")
    .eq("civil_id", parsed.data.civil_id)
    .maybeSingle();

  const status: SignupStatusLookupResult = profile ? STATUS_MAP[profile.account_status] : "not_found";
  return NextResponse.json({ status });
}
