"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/config";
import { resolveSubmissionFields } from "@/lib/submission-fields";
import { getApprovedApprovers, type ApproverInfo } from "@/lib/approver-summary";
import { resolveOrgPosition, formatPositionLabel, type OrgNodeLite } from "@/lib/org-position";
import { buildSubmissionPdfFileName, downloadSubmissionPdf } from "@/lib/pdf/submission-pdf";
import type { FormSubmissionWithRelations } from "@/types";

export function DownloadPdfButton({
  submission,
  approvers,
  orgNodes,
  size = "sm",
  variant = "outline",
}: {
  submission: FormSubmissionWithRelations;
  approvers: ApproverInfo[];
  orgNodes: OrgNodeLite[];
  size?: "sm" | "default";
  variant?: "outline" | "default" | "secondary";
}) {
  const { t, locale } = useI18n();
  const [generating, setGenerating] = useState(false);

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation();
    setGenerating(true);
    try {
      const formTitle =
        (locale === "ar" && submission.form?.title_ar ? submission.form.title_ar : submission.form?.title) ??
        "Form";
      const fields = resolveSubmissionFields(submission.form?.fields, submission.data, locale);
      // Same department-based flow means the submission's own department is
      // the correct fallback for an approver's org position too — legacy
      // routing sends the submission to that department's head.
      const departmentFallback =
        (locale === "ar" && submission.department?.name_ar
          ? submission.department.name_ar
          : submission.department?.name) ?? null;

      const employeePositionLabel = formatPositionLabel(
        resolveOrgPosition(submission.submitted_by, orgNodes),
        departmentFallback,
        locale
      );

      const approverEntries = getApprovedApprovers(submission).map(({ id, date }) => {
        const p = approvers.find((a) => a.id === id);
        const name = p ? ((locale === "ar" && p.name_ar ? p.name_ar : p.name) ?? id) : id;
        const positionLabel = formatPositionLabel(resolveOrgPosition(id, orgNodes), departmentFallback, locale);
        return { name, positionLabel, date: date ? format(new Date(date), "PPP") : null };
      });

      await downloadSubmissionPdf(
        {
          formTitle,
          submissionId: submission.id,
          submittedAt: format(new Date(submission.created_at), "PPP p"),
          employeeName:
            (locale === "ar" && submission.submitter?.name_ar
              ? submission.submitter.name_ar
              : submission.submitter?.name) ?? "—",
          employeePositionLabel,
          employeeEmail: submission.submitter?.email ?? "—",
          approvers: approverEntries,
          fields,
          files: submission.files ?? [],
        },
        buildSubmissionPdfFileName(formTitle, submission.id)
      );
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    } finally {
      setGenerating(false);
    }
  }

  return (
    <Button size={size} variant={variant} className="gap-1" onClick={handleDownload} disabled={generating}>
      {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
      {t("common.downloadPdf")}
    </Button>
  );
}
