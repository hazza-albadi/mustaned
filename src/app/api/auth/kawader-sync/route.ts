import { NextResponse } from "next/server";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { fetchEmployeeProfile } from "@/lib/verification/kawader";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

const KAWADER_TIMEOUT_MS = 3000;

// Race the real call against a hard timeout with a guaranteed fallback
// value — Kawader doesn't exist yet (fetchEmployeeProfile always resolves
// instantly with "unavailable"), but this is written defensively for when
// it does: the product requirement is that this can never hang a request,
// and "may be slow or flaky once it exists" is exactly the failure mode a
// bare `await` wouldn't protect against.
function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: T): Promise<T> {
  return Promise.race([promise, new Promise<T>((resolve) => setTimeout(() => resolve(onTimeout), ms))]);
}

// Called fire-and-forget from login-form.tsx immediately after a successful
// sign-in — the caller never awaits this before completing login, so
// nothing here can slow down or block it either way; the timeout above is
// purely so this request itself can't hang server-side resources
// indefinitely once Kawader is real.
//
// Deliberately touches only the new informational profiles.kawader_*
// columns (0017_kawader_employee_profile.sql). Never writes org_nodes,
// role, or anything else assignment/routing-related — whether/how a
// Kawader-reported department or job path should ever reconcile with a
// person's actual org-chart position is an open product question, not
// something this route resolves.
export async function POST(request: Request) {
  if (!(await rateLimitAsync(`auth:kawader-sync:${getClientIp(request)}`, 10, 60_000))) {
    // Never surfaced to a user — the caller doesn't await this route at
    // all — so a 429 here is exactly as harmless as any other failure mode.
    return NextResponse.json({ ok: false, reason: "rate_limited" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: "unauthenticated" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("civil_id").eq("id", user.id).maybeSingle();
  if (!profile?.civil_id) {
    // The expected case for nearly every account today — confirmed against
    // every account-creation path before writing this feature: only
    // self-service Sign Up ever sets civil_id, and that's currently
    // feature-flagged off. See 0017_kawader_employee_profile.sql.
    return NextResponse.json({ ok: true, status: "skipped_no_civil_id" });
  }

  const result = await withTimeout(fetchEmployeeProfile(profile.civil_id), KAWADER_TIMEOUT_MS, {
    status: "unavailable" as const,
    reason: "Kawader lookup timed out",
  });

  if (result.status !== "verified") {
    // "failed"/"unavailable" — leave the existing kawader_* columns exactly
    // as they were (do nothing), same as the sign-up verification adapters'
    // behavior on a non-"verified" result.
    return NextResponse.json({ ok: true, status: result.status });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      kawader_full_name: result.details.fullName,
      kawader_full_name_ar: result.details.fullNameAr,
      kawader_department: result.details.department,
      kawader_phone: result.details.phone,
      kawader_job_path: result.details.jobPath,
      kawader_synced_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return NextResponse.json({ ok: false, reason: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, status: "verified" });
}
