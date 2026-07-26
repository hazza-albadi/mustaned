"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { ApproveSignupDialog } from "@/components/signups/approve-signup-dialog";
import type { OrgNode, Profile } from "@/types";
import { toast } from "sonner";

export function SignupRequestsTable({
  requests,
  vacantNodes,
}: {
  requests: Profile[];
  vacantNodes: OrgNode[];
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [approveTarget, setApproveTarget] = useState<Profile | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Profile | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const pending = requests.filter((r) => r.account_status === "PENDING");
  const rejected = requests.filter((r) => r.account_status === "REJECTED");

  async function confirmReject() {
    if (!rejectTarget) return;
    setRejecting(true);
    const res = await fetch(`/api/signups/${rejectTarget.id}/reject`, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    setRejecting(false);
    if (!res.ok) {
      toast.error(body.error ?? t("common.error"));
      return;
    }
    toast.success(t("common.success"));
    setRejectTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("signups.title", "Sign-Up Requests")}</h1>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("auth.civilId", "Civil ID")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("common.status")}</TableHead>
              <TableHead>{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pending.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono">{r.civil_id}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{t("signups.pending", "Pending")}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setApproveTarget(r)}>
                      {t("signups.approve", "Approve")}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setRejectTarget(r)}>
                      {t("signups.reject", "Reject")}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {rejected.map((r) => (
              <TableRow key={r.id} className="opacity-70">
                <TableCell className="font-mono">{r.civil_id}</TableCell>
                <TableCell>{r.email}</TableCell>
                <TableCell>
                  <Badge variant="destructive">{t("signups.rejected", "Rejected")}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {t("signups.rejectedNote", "No further action")}
                </TableCell>
              </TableRow>
            ))}
            {requests.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {t("common.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <ApproveSignupDialog
        request={approveTarget}
        vacantNodes={vacantNodes}
        open={!!approveTarget}
        onOpenChange={(o) => !o && setApproveTarget(null)}
      />

      <AlertDialog open={!!rejectTarget} onOpenChange={(o) => !o && setRejectTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("signups.confirmRejectTitle", "Reject this sign-up request?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {rejectTarget?.email} ({rejectTarget?.civil_id})
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReject} disabled={rejecting}>
              {t("signups.reject", "Reject")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
