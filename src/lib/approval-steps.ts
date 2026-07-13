import type { FormSubmission } from "@/types";

export type ApprovalStepRow = {
  stepNumber: number;
  approverId: string;
  status: FormSubmission["status"];
  // When the request arrived at this approver — the submission time for the
  // first step, otherwise the previous step's decision time (null if the
  // previous step hasn't been decided yet, since steps are sequential).
  reachedAt: string | null;
  decidedAt: string | null;
};

// Flattens a submission's approval chain into one row per step, in chain
// order. Falls back to the legacy single-approver fields when there's no
// per-step breakdown at all (pre-multi-approver submissions).
export function getApprovalSteps(
  submission: Pick<FormSubmission, "approvals" | "approver_id" | "approved_at" | "status" | "created_at">
): ApprovalStepRow[] {
  if (submission.approvals && submission.approvals.length > 0) {
    return submission.approvals.map((entry, i) => ({
      stepNumber: i + 1,
      approverId: entry.approver_id,
      status: entry.status,
      reachedAt: i === 0 ? submission.created_at : submission.approvals[i - 1].decided_at,
      decidedAt: entry.decided_at,
    }));
  }
  if (submission.approver_id) {
    return [
      {
        stepNumber: 1,
        approverId: submission.approver_id,
        status: submission.status,
        reachedAt: submission.created_at,
        decidedAt: submission.approved_at,
      },
    ];
  }
  return [];
}

// "2 days 4 hours" / "5 hours 12 minutes" / "12 minutes" — coarsest two
// units, dropping the smaller one once it would round to zero.
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} day${days !== 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""}`;
  if (hours > 0) return `${hours} hour${hours !== 1 ? "s" : ""} ${minutes} minute${minutes !== 1 ? "s" : ""}`;
  return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
}
