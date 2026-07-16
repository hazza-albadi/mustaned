import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import type { ApprovalEntry, SubmissionStatus } from "@/types";

// S-04 fix: the previous client-side flow (approve-reject-dialog.tsx) built
// the entire next `approvals` array and sent it straight to Supabase via an
// UPDATE on the caller's own session client, trusting the RLS policy alone
// to gate *whether* they could write, but not *what* they wrote. This route
// now:
//   1. Loads the current row itself (never trusts a client-submitted array).
//   2. Confirms the caller is the approver of the first still-PENDING entry
//      (or, for genuinely legacy submissions with no approvals array, relies
//      on RLS's narrower legacy-only decide policy).
//   3. Rebuilds only that one entry's status/comment/decided_at itself.
// The UPDATE still runs through the caller's own session client so RLS
// remains a real second gate, not just this route's say-so.
const decisionSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  comment: z.string().nullable().optional(),
});

function computeOverallStatus(approvals: ApprovalEntry[]): SubmissionStatus {
  if (approvals.some((a) => a.status === "REJECTED")) return "REJECTED";
  if (approvals.length > 0 && approvals.every((a) => a.status === "APPROVED")) return "APPROVED";
  return "PENDING";
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await rateLimitAsync(`submissions:decision:${getClientIp(request)}`, 60, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = decisionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { action, comment } = parsed.data;
  const trimmedComment = comment?.trim() || null;

  if (action === "REJECTED" && (!trimmedComment || trimmedComment.length < 3)) {
    return NextResponse.json({ error: "A comment is required when rejecting a request" }, { status: 400 });
  }

  const { data: submission, error: fetchError } = await supabase
    .from("form_submissions")
    .select("id, status, approvals")
    .eq("id", id)
    .maybeSingle();

  if (fetchError || !submission) {
    return NextResponse.json({ error: "Submission not found" }, { status: 404 });
  }

  if (submission.status !== "PENDING") {
    return NextResponse.json({ error: "This submission has already been decided" }, { status: 409 });
  }

  const approvals = submission.approvals ?? [];
  const now = new Date().toISOString();

  let updatedApprovals: ApprovalEntry[];
  let newStatus: SubmissionStatus;

  if (approvals.length > 0) {
    const isCurrentApprover = approvals.some((a) => a.approver_id === user.id && a.status === "PENDING");
    if (!isCurrentApprover) {
      return NextResponse.json(
        { error: "You are not the current approver for this submission" },
        { status: 403 }
      );
    }
    updatedApprovals = approvals.map((entry) =>
      entry.approver_id === user.id && entry.status === "PENDING"
        ? { ...entry, status: action, comment: trimmedComment, decided_at: now }
        : entry
    );
    newStatus = computeOverallStatus(updatedApprovals);
  } else {
    // Legacy single-approver submissions carry no per-step array — identity
    // is enforced entirely by RLS's legacy-only decide policy.
    updatedApprovals = approvals;
    newStatus = action;
  }

  const { data: updated, error: updateError } = await supabase
    .from("form_submissions")
    .update({
      approvals: updatedApprovals,
      status: newStatus,
      approver_id: user.id,
      approver_comment: trimmedComment,
      approved_at: action === "APPROVED" ? now : null,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }
  if (!updated) {
    // RLS silently filtered the row — the caller passed the app-layer check
    // above but isn't actually authorized at the database layer either.
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
