"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/config";
import type { OrgNode, Profile } from "@/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Reuses the same "assign to an org node" mechanism as the Org Chart page
// (org_nodes.assigned_profile_id), just triggered from the approval action
// instead of a separate trip to /admin/org — see the approve-signups route
// for the permission-boundary rationale. Placement is optional: leaving it
// on "assign later" still approves the account, which then behaves like any
// other unassigned employee on the existing Org Chart page.
export function ApproveSignupDialog({
  request,
  vacantNodes,
  open,
  onOpenChange,
}: {
  request: Profile | null;
  vacantNodes: OrgNode[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [nodeId, setNodeId] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setNodeId("");
  }, [open]);

  if (!request) return null;

  async function handleApprove() {
    setSaving(true);
    try {
      const res = await fetch(`/api/signups/${request!.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ node_id: nodeId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("common.error"));

      if (body.warning) {
        toast.warning(body.warning);
      } else {
        toast.success(t("common.success"));
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("signups.approveTitle", "Approve sign-up request")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {request.email} ({request.civil_id})
          </p>

          <div className="space-y-2">
            <Label>{t("signups.assignPosition", "Assign position (optional)")}</Label>
            <Select value={nodeId || "later"} onValueChange={(v) => setNodeId(v === "later" ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="later">{t("signups.assignLater", "Assign later")}</SelectItem>
                {vacantNodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vacantNodes.length === 0 && (
              <p className="text-xs text-muted-foreground">
                {t("signups.noPositionsAvailable", "No vacant positions available")}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handleApprove} disabled={saving}>
            {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t("signups.approve", "Approve")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
