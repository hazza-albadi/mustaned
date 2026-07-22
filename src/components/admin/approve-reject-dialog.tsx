"use client";

import { useState } from "react";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { resolveSubmissionFields } from "@/lib/submission-fields";
import type { FormSubmissionWithRelations } from "@/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function ApproveRejectDialog({
  submission,
  action,
  open,
  onOpenChange,
  onComplete,
}: {
  submission: FormSubmissionWithRelations | null;
  action: "APPROVED" | "REJECTED" | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}) {
  const { t, locale } = useI18n();
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

    // S-04 fix: the decision (who the current approver is, and rebuilding the
    // approvals array/overall status) is now computed server-side
    // (src/app/api/submissions/[id]/decision/route.ts) from the caller's own
    // session, instead of trusting a client-built approvals array.
    const res = await fetch(`/api/submissions/${submission.id}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, comment: comment.trim() || null }),
    });
    const body = await res.json().catch(() => ({}));

    setSubmitting(false);

    if (!res.ok) {
      toast.error(body.error ?? t("common.error"));
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
              if (field.kind === "table") {
                return (
                  <div key={field.id} className="space-y-1.5">
                    <p className="text-muted-foreground">{field.label}</p>
                    {field.rows.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{t("fill.tableNoRowsSubmitted")}</p>
                    ) : (
                      <div className="overflow-x-auto rounded-md border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {field.columns.map((col) => (
                                <TableHead key={col} className="text-xs">
                                  {col}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {field.rows.map((row, i) => (
                              <TableRow key={i}>
                                {field.columns.map((col) => (
                                  <TableCell key={col} className="whitespace-normal text-xs">
                                    {row[col] || "—"}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
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
