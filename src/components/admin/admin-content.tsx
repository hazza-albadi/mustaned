"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/config";
import { useDebounce } from "@/hooks/use-debounce";
import { downloadCsv } from "@/lib/csv";
import { StatCard } from "@/components/dashboard/stat-card";
import { ApproveRejectDialog } from "@/components/admin/approve-reject-dialog";
import { SubmissionDetailDialog } from "@/components/common/submission-detail-dialog";
import { DownloadPdfButton } from "@/components/common/download-pdf-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Pagination } from "@/components/common/pagination";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import type { ApproverInfo } from "@/lib/approver-summary";
import type { OrgNodeLite } from "@/lib/org-position";
import type { FormSubmissionWithRelations, Role } from "@/types";
import { StatusBadge } from "@/components/common/status-badge";
import { format } from "date-fns";
import { Check, Clock, Download, Eye, Search, X, XCircle } from "lucide-react";

const PAGE_SIZE = 8;

export function AdminContent({
  submissions,
  approverId,
  approvers,
  orgNodes,
  role,
}: {
  submissions: FormSubmissionWithRelations[];
  approverId: string;
  approvers: ApproverInfo[];
  orgNodes: OrgNodeLite[];
  role: Role;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [page, setPage] = useState(1);
  const [actionTarget, setActionTarget] = useState<{
    submission: FormSubmissionWithRelations;
    action: "APPROVED" | "REJECTED";
  } | null>(null);
  const [viewTarget, setViewTarget] = useState<FormSubmissionWithRelations | null>(null);

  // Only a Department Head can approve/reject, and only from their own
  // pending queue — Super Admin is view-only regardless of the approvals
  // array contents.
  const canApprove = role === "DEPARTMENT_HEAD";

  function myApprovalEntry(s: FormSubmissionWithRelations) {
    return s.approvals?.find((a) => a.approver_id === approverId) ?? null;
  }

  function isActionableByMe(s: FormSubmissionWithRelations) {
    if (!canApprove) return false;
    if (s.status !== "PENDING") return false;
    // Truly legacy submission with no per-approver breakdown at all →
    // actionable by anyone with visibility (the old single-approver model).
    if (!s.approvals || s.approvals.length === 0) return true;
    // Otherwise this is a real approvals array — being visible to me (e.g.
    // as the submitter, via "Employees view own submissions") doesn't make
    // it mine to act on; I must actually be listed as a pending approver.
    const myEntry = myApprovalEntry(s);
    return myEntry?.status === "PENDING";
  }

  const pending = submissions.filter((s) => s.status === "PENDING");
  const approved = submissions.filter((s) => s.status === "APPROVED");
  const rejected = submissions.filter((s) => s.status === "REJECTED");

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const formTitle = (locale === "ar" && s.form?.title_ar ? s.form.title_ar : s.form?.title) ?? "";
      const submitter = s.submitter?.name ?? "";
      return (
        formTitle.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
        submitter.toLowerCase().includes(debouncedSearch.toLowerCase())
      );
    });
  }, [submissions, debouncedSearch, locale]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    submissions.forEach((s) => {
      const day = format(new Date(s.created_at), "MM/dd");
      map.set(day, (map.get(day) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([date, count]) => ({ date, count }))
      .slice(-14);
  }, [submissions]);

  function exportCsv() {
    downloadCsv(
      `submissions-${format(new Date(), "yyyy-MM-dd")}.csv`,
      submissions.map((s) => ({
        form: s.form?.title,
        submitted_by: s.submitter?.name,
        department: s.department?.name,
        status: s.status,
        submitted_at: s.created_at,
        approver_comment: s.approver_comment ?? "",
        ...s.data,
      }))
    );
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold tracking-tight">{t("admin.panelTitle")}</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("dashboard.pending")} value={pending.length} icon={Clock} />
        <StatCard label={t("dashboard.approved")} value={approved.length} icon={Check} />
        <StatCard label={t("dashboard.rejected")} value={rejected.length} icon={XCircle} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("admin.submissionsByStatus")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="date" fontSize={12} />
              <YAxis fontSize={12} allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{t("admin.allSubmissions")}</h2>
          <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv}>
            <Download className="h-3.5 w-3.5" /> {t("common.export")}
          </Button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            className="ps-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("common.name")}</TableHead>
                <TableHead>{t("admin.submittedBy")}</TableHead>
                <TableHead>{t("admin.submittedOn")}</TableHead>
                <TableHead>{t("common.status")}</TableHead>
                <TableHead>{t("common.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageItems.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                    {t("admin.noSubmissions")}
                  </TableCell>
                </TableRow>
              )}
              {pageItems.map((s) => {
                const actionable = isActionableByMe(s);
                return (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => setViewTarget(s)}>
                    <TableCell className="font-medium">
                      {locale === "ar" && s.form?.title_ar ? s.form.title_ar : s.form?.title}
                    </TableCell>
                    <TableCell>{s.submitter?.name}</TableCell>
                    <TableCell>{format(new Date(s.created_at), "PP")}</TableCell>
                    <TableCell>
                      <StatusBadge status={s.status} label={t(`status.${s.status}`)} />
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="gap-1" onClick={() => setViewTarget(s)}>
                          <Eye className="h-3.5 w-3.5" /> {t("common.view")}
                        </Button>
                        {s.status === "APPROVED" && (
                          <DownloadPdfButton submission={s} approvers={approvers} orgNodes={orgNodes} />
                        )}
                        {actionable && (
                          <>
                            <Button
                              size="sm"
                              className="gap-1"
                              onClick={() => setActionTarget({ submission: s, action: "APPROVED" })}
                            >
                              <Check className="h-3.5 w-3.5" /> {t("admin.approve")}
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="gap-1"
                              onClick={() => setActionTarget({ submission: s, action: "REJECTED" })}
                            >
                              <X className="h-3.5 w-3.5" /> {t("admin.reject")}
                            </Button>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />
      </section>

      <ApproveRejectDialog
        submission={actionTarget?.submission ?? null}
        action={actionTarget?.action ?? null}
        approverId={approverId}
        open={!!actionTarget}
        onOpenChange={(open) => !open && setActionTarget(null)}
        onComplete={() => router.refresh()}
      />

      <SubmissionDetailDialog
        submission={viewTarget}
        approvers={approvers}
        orgNodes={orgNodes}
        open={!!viewTarget}
        onOpenChange={(open) => !open && setViewTarget(null)}
      />
    </div>
  );
}
