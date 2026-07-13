import type { FormSubmission, Profile } from "@/types";
import type { Locale } from "@/lib/i18n/config";

export type ApproverInfo = Pick<Profile, "id" | "name" | "name_ar">;

export type ApprovalSummary = {
  names: string;
  date: string | null;
};

// Approvals only store approver ids, so resolving a display name requires a
// directory of dept heads fetched separately (approvers may be deactivated
// after they approved something, so the directory query must not filter on
// is_active).
export function getApprovalSummary(
  submission: Pick<FormSubmission, "approvals" | "approver_id" | "approved_at">,
  approvers: ApproverInfo[],
  locale: Locale
): ApprovalSummary | null {
  const nameFor = (id: string) => {
    const p = approvers.find((a) => a.id === id);
    if (!p) return null;
    return locale === "ar" && p.name_ar ? p.name_ar : p.name;
  };

  if (submission.approvals && submission.approvals.length > 0) {
    const approved = submission.approvals.filter((a) => a.status === "APPROVED");
    if (approved.length === 0) return null;
    const names = approved.map((a) => nameFor(a.approver_id) ?? a.approver_id).join(", ");
    const dates = approved
      .map((a) => a.decided_at)
      .filter((d): d is string => Boolean(d))
      .sort();
    return { names, date: dates.length > 0 ? dates[dates.length - 1] : null };
  }

  if (submission.approver_id) {
    return { names: nameFor(submission.approver_id) ?? submission.approver_id, date: submission.approved_at };
  }

  return null;
}

// Same source data as getApprovalSummary, but as individual entries instead
// of one concatenated string — needed anywhere each approver's own position
// is shown alongside their name (e.g. the PDF export).
export function getApprovedApprovers(
  submission: Pick<FormSubmission, "approvals" | "approver_id" | "approved_at">
): { id: string; date: string | null }[] {
  if (submission.approvals && submission.approvals.length > 0) {
    return submission.approvals
      .filter((a) => a.status === "APPROVED")
      .map((a) => ({ id: a.approver_id, date: a.decided_at ?? null }));
  }
  if (submission.approver_id) {
    return [{ id: submission.approver_id, date: submission.approved_at ?? null }];
  }
  return [];
}
