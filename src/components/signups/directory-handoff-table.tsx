"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { useI18n } from "@/lib/i18n/config";
import { downloadCsv } from "@/lib/csv";
import { resolveOrgPosition, formatPositionLabel, type OrgNodeLite } from "@/lib/org-position";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { OrgNode, Profile } from "@/types";
import { Download } from "lucide-react";
import { toast } from "sonner";

type ApproverInfo = Pick<Profile, "id" | "name" | "name_ar">;

// The IT handoff view: every account an admin has approved but that still
// needs its directory account created by hand (Mustanad never creates one
// itself — see TODO(directory-integration) in src/lib/verification/directory.ts).
// Lives as a second section of /admin/signups rather than a sibling page:
// it's the same reviewing-admin audience and the same approve_signups gate
// as the table above it, just the next stage of the same queue — a separate
// page would just add a navigation hop for no boundary that actually exists.
export function DirectoryHandoffTable({
  requests,
  nodes,
  approvers,
}: {
  requests: Profile[];
  nodes: OrgNode[];
  approvers: ApproverInfo[];
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const [target, setTarget] = useState<Profile | null>(null);
  const [saving, setSaving] = useState(false);

  const awaitingDirectory = requests.filter((r) => r.account_status === "APPROVED_AWAITING_DIRECTORY");

  function approverName(id: string | null) {
    if (!id) return null;
    const approver = approvers.find((a) => a.id === id);
    if (!approver) return id;
    return locale === "ar" && approver.name_ar ? approver.name_ar : approver.name;
  }

  function positionLabel(profileId: string) {
    return formatPositionLabel(resolveOrgPosition(profileId, nodes as OrgNodeLite[]), locale);
  }

  const rows = useMemo(
    () =>
      awaitingDirectory.map((r) => ({
        profile: r,
        position: positionLabel(r.id),
        approvedByName: approverName(r.approved_by),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [awaitingDirectory, nodes, approvers, locale]
  );

  function exportCsv() {
    downloadCsv(
      `directory-handoff-${format(new Date(), "yyyy-MM-dd")}.csv`,
      rows.map(({ profile, position, approvedByName }) => ({
        name_en: profile.name,
        name_ar: profile.name_ar ?? "",
        email: profile.email,
        civil_id: profile.civil_id ?? "",
        position: position ?? "",
        approved_by: approvedByName ?? "",
        approved_at: profile.approved_at ?? "",
      }))
    );
  }

  async function confirmMarkCreated() {
    if (!target) return;
    setSaving(true);
    const res = await fetch(`/api/signups/${target.id}/mark-created`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(body.error ?? t("common.error"));
      return;
    }
    toast.success(t("common.success"));
    setTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">{t("signups.handoffTitle", "Directory Account Creation")}</h2>
        <Button variant="outline" size="sm" className="gap-1" onClick={exportCsv} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5" /> {t("common.export")}
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        {t(
          "signups.handoffDesc",
          "Approved requests waiting on a directory account. Create the account through your normal IT process, then mark it created here."
        )}
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("signups.nameEn", "Name (English)")}</TableHead>
              <TableHead>{t("signups.nameAr", "Name (Arabic)")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("auth.civilId", "Civil ID")}</TableHead>
              <TableHead>{t("signups.position", "Position")}</TableHead>
              <TableHead>{t("common.approvedBy", "Approved by")}</TableHead>
              <TableHead>{t("signups.approvedAt", "Approved At")}</TableHead>
              <TableHead>{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(({ profile, position, approvedByName }) => (
              <TableRow key={profile.id}>
                <TableCell>{profile.name}</TableCell>
                <TableCell dir="rtl" className="text-end">
                  {profile.name_ar ?? "—"}
                </TableCell>
                <TableCell>{profile.email}</TableCell>
                <TableCell className="font-mono">{profile.civil_id}</TableCell>
                <TableCell>{position ?? "—"}</TableCell>
                <TableCell>{approvedByName ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {profile.approved_at ? format(new Date(profile.approved_at), "PP p") : "—"}
                </TableCell>
                <TableCell>
                  <Button size="sm" onClick={() => setTarget(profile)}>
                    {t("signups.markCreated", "Mark as Created")}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  {t("common.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("signups.confirmMarkCreatedTitle", "Mark this account as created in the directory?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.email} ({target?.civil_id}) —{" "}
              {t(
                "signups.confirmMarkCreatedDesc",
                "This activates their Mustanad account. Only confirm once the directory account actually exists."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmMarkCreated} disabled={saving}>
              {t("signups.markCreated", "Mark as Created")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
