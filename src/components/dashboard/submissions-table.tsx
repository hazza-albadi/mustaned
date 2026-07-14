"use client";

import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/common/status-badge";
import { Pagination } from "@/components/common/pagination";
import { SubmissionDetailDialog } from "@/components/common/submission-detail-dialog";
import { DownloadPdfButton } from "@/components/common/download-pdf-button";
import { useI18n } from "@/lib/i18n/config";
import { useDebounce } from "@/hooks/use-debounce";
import type { ApproverInfo } from "@/lib/approver-summary";
import type { FormSubmissionWithRelations, SubmissionStatus } from "@/types";
import { format } from "date-fns";
import { Search, Eye } from "lucide-react";

const PAGE_SIZE = 8;

export function SubmissionsTable({
  submissions,
  approvers,
}: {
  submissions: FormSubmissionWithRelations[];
  approvers: ApproverInfo[];
}) {
  const { t, locale } = useI18n();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);
  const [status, setStatus] = useState<SubmissionStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<FormSubmissionWithRelations | null>(null);

  const filtered = useMemo(() => {
    return submissions.filter((s) => {
      const formTitle = (locale === "ar" && s.form?.title_ar ? s.form.title_ar : s.form?.title) ?? "";
      const matchesSearch = formTitle.toLowerCase().includes(debouncedSearch.toLowerCase());
      const matchesStatus = status === "ALL" || s.status === status;
      return matchesSearch && matchesStatus;
    });
  }, [submissions, debouncedSearch, status, locale]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v as SubmissionStatus | "ALL");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">{t("common.all")}</SelectItem>
            <SelectItem value="PENDING">{t("status.PENDING")}</SelectItem>
            <SelectItem value="APPROVED">{t("status.APPROVED")}</SelectItem>
            <SelectItem value="REJECTED">{t("status.REJECTED")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.date")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageItems.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {t("common.noResults")}
                </TableCell>
              </TableRow>
            )}
            {pageItems.map((s) => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => setSelected(s)}>
                <TableCell className="font-medium">
                  {locale === "ar" && s.form?.title_ar ? s.form.title_ar : s.form?.title}
                </TableCell>
                <TableCell>{format(new Date(s.created_at), "PP")}</TableCell>
                <TableCell>
                  <StatusBadge status={s.status} label={t(`status.${s.status}`)} />
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" className="gap-1" onClick={() => setSelected(s)}>
                      <Eye className="h-3.5 w-3.5" /> {t("common.view")}
                    </Button>
                    {s.status === "APPROVED" && <DownloadPdfButton submissionId={s.id} />}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination page={page} pageCount={pageCount} onPageChange={setPage} />

      <SubmissionDetailDialog
        submission={selected}
        approvers={approvers}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
    </div>
  );
}
