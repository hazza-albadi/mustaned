"use client";

import { useI18n } from "@/lib/i18n/config";
import { SubmissionsTable } from "@/components/dashboard/submissions-table";
import type { ApproverInfo } from "@/lib/approver-summary";
import type { FormSubmissionWithRelations } from "@/types";

export function MySubmissionsContent({
  submissions,
  approvers,
}: {
  submissions: FormSubmissionWithRelations[];
  approvers: ApproverInfo[];
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.mySubmissions")}</h1>
      <SubmissionsTable submissions={submissions} approvers={approvers} />
    </div>
  );
}
