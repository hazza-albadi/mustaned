"use client";

import { useI18n } from "@/lib/i18n/config";
import { StatCard } from "@/components/dashboard/stat-card";
import { SubmissionsTable } from "@/components/dashboard/submissions-table";
import type { ApproverInfo } from "@/lib/approver-summary";
import type { OrgNodeLite } from "@/lib/org-position";
import type { FormSubmissionWithRelations } from "@/types";
import { ClipboardList, Clock, CheckCircle2, XCircle } from "lucide-react";

export function DashboardContent({
  submissions,
  stats,
  approvers,
  orgNodes,
}: {
  submissions: FormSubmissionWithRelations[];
  stats: { total: number; pending: number; approved: number; rejected: number };
  approvers: ApproverInfo[];
  orgNodes: OrgNodeLite[];
}) {
  const { t } = useI18n();

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("dashboard.mySubmissions")}</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t("dashboard.totalSubmissions")} value={stats.total} icon={ClipboardList} />
        <StatCard label={t("dashboard.pending")} value={stats.pending} icon={Clock} />
        <StatCard label={t("dashboard.approved")} value={stats.approved} icon={CheckCircle2} />
        <StatCard label={t("dashboard.rejected")} value={stats.rejected} icon={XCircle} />
      </div>

      <section className="space-y-4">
        <SubmissionsTable submissions={submissions} approvers={approvers} orgNodes={orgNodes} />
      </section>
    </div>
  );
}
