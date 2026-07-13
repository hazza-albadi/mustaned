"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n/config";
import { downloadXlsx } from "@/lib/xlsx-export";
import { getApprovalSteps, formatDuration } from "@/lib/approval-steps";
import { resolveOrgPosition, formatPositionLabel, type OrgNodeLite } from "@/lib/org-position";
import type { ApproverInfo } from "@/lib/approver-summary";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { FormSubmissionWithRelations, FormDefinition } from "@/types";
import { format } from "date-fns";
import { ClipboardList, Clock, CheckCircle2, XCircle, Download, Printer, FileText } from "lucide-react";

const COLORS = [
  "var(--utas-navy)",
  "var(--utas-orange)",
  "var(--utas-teal)",
  "var(--utas-gold)",
  "var(--utas-olive)",
  "var(--utas-purple)",
  "var(--utas-blue)",
];

export function AnalyticsContent({
  forms,
  submissions,
  profiles,
  orgNodes,
}: {
  forms: FormDefinition[];
  submissions: FormSubmissionWithRelations[];
  profiles: ApproverInfo[];
  orgNodes: OrgNodeLite[];
}) {
  const { t, locale } = useI18n();
  const [selectedFormId, setSelectedFormId] = useState<string>("ALL");

  const filteredSubmissions = useMemo(
    () => (selectedFormId === "ALL" ? submissions : submissions.filter((s) => s.form_id === selectedFormId)),
    [submissions, selectedFormId]
  );

  const pending = filteredSubmissions.filter((s) => s.status === "PENDING").length;
  const approved = filteredSubmissions.filter((s) => s.status === "APPROVED").length;
  const rejected = filteredSubmissions.filter((s) => s.status === "REJECTED").length;
  const totalFormsCount = selectedFormId === "ALL" ? forms.length : 1;

  const byDepartment = useMemo(() => {
    const map = new Map<string, number>();
    filteredSubmissions.forEach((s) => {
      const name = s.department?.name ?? "Unknown";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [filteredSubmissions]);

  const byForm = useMemo(() => {
    const map = new Map<string, number>();
    filteredSubmissions.forEach((s) => {
      const name = s.form?.title ?? "Unknown";
      map.set(name, (map.get(name) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7);
  }, [filteredSubmissions]);

  const monthlyTrend = useMemo(() => {
    const map = new Map<string, number>();
    filteredSubmissions.forEach((s) => {
      const key = format(new Date(s.created_at), "MMM yyyy");
      map.set(key, (map.get(key) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([month, count]) => ({ month, count }));
  }, [filteredSubmissions]);

  const avgApprovalHours = useMemo(() => {
    const resolved = filteredSubmissions.filter((s) => s.approved_at);
    if (resolved.length === 0) return 0;
    const totalHours = resolved.reduce((sum, s) => {
      const diff = new Date(s.approved_at!).getTime() - new Date(s.created_at).getTime();
      return sum + diff / (1000 * 60 * 60);
    }, 0);
    return Math.round((totalHours / resolved.length) * 10) / 10;
  }, [filteredSubmissions]);

  function exportExcel() {
    const submissionRows = filteredSubmissions.map((s) => ({
      form: s.form?.title,
      department: s.department?.name,
      submitted_by: s.submitter?.name,
      status: s.status,
      submitted_at: s.created_at,
      approved_at: s.approved_at ?? "",
    }));

    // One row per approval step (not per submission) — "who approved, from
    // what position, how long it took" only makes sense at that grain.
    const approvalRows = filteredSubmissions.flatMap((s) => {
      const departmentFallback =
        (locale === "ar" && s.department?.name_ar ? s.department.name_ar : s.department?.name) ?? null;

      return getApprovalSteps(s).map((step) => {
        const approverProfile = profiles.find((p) => p.id === step.approverId);
        const approverName = approverProfile
          ? ((locale === "ar" && approverProfile.name_ar ? approverProfile.name_ar : approverProfile.name) ??
              step.approverId)
          : step.approverId;
        const positionLabel = formatPositionLabel(
          resolveOrgPosition(step.approverId, orgNodes),
          departmentFallback,
          locale
        );
        const timeTaken =
          step.reachedAt && step.decidedAt
            ? formatDuration(new Date(step.decidedAt).getTime() - new Date(step.reachedAt).getTime())
            : "";

        return {
          submission_id: s.id,
          form: s.form?.title,
          submitted_by: s.submitter?.name,
          step: step.stepNumber,
          approver_name: approverName,
          approver_position: positionLabel ?? "",
          status: step.status,
          reached_at: step.reachedAt ? format(new Date(step.reachedAt), "PPP p") : "",
          decided_at: step.decidedAt ? format(new Date(step.decidedAt), "PPP p") : "",
          time_taken: timeTaken,
        };
      });
    });

    downloadXlsx(`analytics-${format(new Date(), "yyyy-MM-dd")}.xlsx`, [
      { name: "Submissions", rows: submissionRows },
      { name: "Approvals", rows: approvalRows },
    ]);
  }

  return (
    <div className="space-y-8 print:space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.analytics")}</h1>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <Select value={selectedFormId} onValueChange={setSelectedFormId}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">{t("admin.allForms", "All Forms")}</SelectItem>
              {forms.map((f) => (
                <SelectItem key={f.id} value={f.id}>
                  {locale === "ar" && f.title_ar ? f.title_ar : f.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1" onClick={exportExcel}>
            <Download className="h-3.5 w-3.5" /> {t("admin.exportExcel", "Export Excel")}
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total Forms" value={totalFormsCount} icon={FileText} />
        <StatCard label="Total Submissions" value={filteredSubmissions.length} icon={ClipboardList} />
        <StatCard label={t("dashboard.pending")} value={pending} icon={Clock} />
        <StatCard label={t("dashboard.approved")} value={approved} icon={CheckCircle2} />
        <StatCard label={t("dashboard.rejected")} value={rejected} icon={XCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Average Approval Time</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{avgApprovalHours}h</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submissions by Department</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byDepartment}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis fontSize={12} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--utas-navy)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submissions by Form</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={byForm} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {byForm.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Submission Trends</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="month" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Line type="monotone" dataKey="count" stroke="var(--utas-orange)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
