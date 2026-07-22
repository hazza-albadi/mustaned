"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/common/status-badge";
import { DownloadPdfButton } from "@/components/common/download-pdf-button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/config";
import { resolveSubmissionFields } from "@/lib/submission-fields";
import { getApprovalSummary, type ApproverInfo } from "@/lib/approver-summary";
import { format } from "date-fns";
import type { FormSubmissionWithRelations } from "@/types";
import { File as FileIcon } from "lucide-react";

export function SubmissionDetailDialog({
  submission,
  approvers,
  open,
  onOpenChange,
}: {
  submission: FormSubmissionWithRelations | null;
  approvers: ApproverInfo[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t, locale } = useI18n();
  if (!submission) return null;

  const formTitle =
    locale === "ar" && submission.form?.title_ar ? submission.form.title_ar : submission.form?.title;
  const fields = resolveSubmissionFields(submission.form?.fields, submission.data, locale);
  const approvalSummary =
    submission.status === "APPROVED" ? getApprovalSummary(submission, approvers, locale) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{formTitle}</DialogTitle>
          <DialogDescription>
            {t("admin.submittedOn")}: {format(new Date(submission.created_at), "PPP p")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("common.status")}:</span>
            <StatusBadge status={submission.status} label={t(`status.${submission.status}`)} />
          </div>

          {approvalSummary && (
            <p className="text-xs text-muted-foreground">
              {t("common.approvedBy")}: {approvalSummary.names}
              {approvalSummary.date && ` · ${format(new Date(approvalSummary.date), "PPP")}`}
            </p>
          )}

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
                  <FileIcon className="h-4 w-4" /> {f.name}
                </a>
              ))}
            </div>
          )}

          {submission.status !== "PENDING" && submission.approver_comment && (
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <p className="font-medium">{t("common.comment")}</p>
              <p className="mt-1 text-muted-foreground">{submission.approver_comment}</p>
            </div>
          )}

          {submission.status === "APPROVED" && (
            <DownloadPdfButton submissionId={submission.id} variant="default" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
