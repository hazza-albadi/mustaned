"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { resolveSubmissionFields } from "@/lib/submission-fields";
import type { ApprovalEntry, FormSubmissionWithRelations, SubmissionStatus } from "@/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

function computeOverallStatus(approvals: ApprovalEntry[]): SubmissionStatus {
  if (approvals.some((a) => a.status === "REJECTED")) return "REJECTED";
  if (approvals.length > 0 && approvals.every((a) => a.status === "APPROVED")) return "APPROVED";
  return "PENDING";
}

export function ApproveRejectDialog({
  submission,
  action,
  approverId,
  open,
  onOpenChange,
  onComplete,
}: {
  submission: FormSubmissionWithRelations | null;
  action: "APPROVED" | "REJECTED" | null;
  approverId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}) {
  const { t, locale } = useI18n();
  const supabase = createClient();
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!submission || !action) return null;

  const isReject = action === "REJECTED";
  const formTitle =
    locale === "ar" && submission.form?.title_ar ? submission.form.title_ar : submission.form?.title;
  const fields = resolveSubmissionFields(submission.form?.fields, submission.data, locale);

  async function handleConfirm() {
    if (!submission || !action) return;
    if (isReject && comment.trim().length < 3) {
      toast.error(t("admin.rejectCommentRequired"));
      return;
    }

    setSubmitting(true);

    const now = new Date().toISOString();

    // Build the updated approvals array. If this submission has multi-approver
    // entries in the approvals column, update only this approver's entry.
    // Fall back to the legacy single-approver path if approvals is empty.
    let updatedApprovals: ApprovalEntry[];
    let newStatus: SubmissionStatus;

    if (submission.approvals && submission.approvals.length > 0) {
      updatedApprovals = submission.approvals.map((entry) =>
        entry.approver_id === approverId
          ? { ...entry, status: action, comment: comment.trim() || null, decided_at: now }
          : entry
      );
      newStatus = computeOverallStatus(updatedApprovals);
    } else {
      // Legacy single-approver flow: no approvals array — just update top-level status.
      updatedApprovals = submission.approvals ?? [];
      newStatus = action;
    }

    const { error } = await supabase
      .from("form_submissions")
      .update({
        approvals: updatedApprovals,
        status: newStatus,
        // Keep the legacy columns in sync for backwards compatibility.
        approver_id: approverId,
        approver_comment: comment.trim() || null,
        approved_at: action === "APPROVED" ? now : null,
      })
      .eq("id", submission.id);

    setSubmitting(false);

    if (error) {
      toast.error(t("common.error"));
      return;
    }

    toast.success(t("common.success"));
    setComment("");
    onOpenChange(false);
    onComplete();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isReject ? t("admin.rejectTitle") : t("admin.approveTitle")}</DialogTitle>
          <DialogDescription>
            {isReject ? t("admin.rejectSubtitle") : t("admin.approveConfirm")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {formTitle && <p className="text-sm font-medium">{formTitle}</p>}
          <div className="space-y-3 rounded-md border p-3 text-sm">
            {fields.map((field) => {
              if (field.kind === "section_heading") {
                return (
                  <div key={field.id} className="border-b pb-2 pt-1 first:pt-0">
                    <p className="text-base font-bold">{field.heading}</p>
                    {field.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{field.description}</p>
                    )}
                  </div>
                );
              }
              if (field.kind === "image_block") {
                return (
                  <div key={field.id} className="flex flex-col items-center gap-1 py-1">
                    {field.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- user-provided external URL
                      <img
                        src={field.imageUrl}
                        alt={field.caption ?? ""}
                        className="max-h-48 max-w-full rounded-md object-contain"
                      />
                    )}
                    {field.caption && <p className="text-xs text-muted-foreground">{field.caption}</p>}
                  </div>
                );
              }
              return (
                <div key={field.id} className="flex justify-between gap-4">
                  <span className="text-muted-foreground">{field.label}</span>
                  <span className="text-end font-medium">{field.value}</span>
                </div>
              );
            })}
          </div>

          {submission.files?.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t("fill.attachments")}</p>
              {submission.files.map((f) => (
                <a
                  key={f.name}
                  href={f.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2 text-sm hover:underline"
                >
                  {f.name}
                </a>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>
            {t("common.comment")} {isReject && <span className="text-red-500">*</span>}
          </Label>
          <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button
            variant={isReject ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {isReject ? t("admin.reject") : t("admin.approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
