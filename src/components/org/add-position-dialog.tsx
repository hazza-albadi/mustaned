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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AssignPersonPicker } from "@/components/org/assign-person-picker";
import { resolveAssignedProfileId, type AssignPersonValue } from "@/lib/assign-person";
import { useI18n } from "@/lib/i18n/config";
import type { OrgNode, Profile } from "@/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AddPositionDialog({
  allNodes,
  unassignedProfiles,
  defaultParentId,
  open,
  onOpenChange,
}: {
  allNodes: OrgNode[];
  unassignedProfiles: Profile[];
  // Pre-fills the parent dropdown with the currently selected node, so
  // adding a position from the canvas nests it under whatever was last clicked.
  defaultParentId?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState("");
  const [assignValue, setAssignValue] = useState<AssignPersonValue>({ mode: "none" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setParentId(defaultParentId ?? "");
      setAssignValue({ mode: "none" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultParentId]);

  function reset() {
    setTitle("");
    setParentId("");
    setAssignValue({ mode: "none" });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // A brand-new position has no children yet, so a newly created
      // person here always starts as an EMPLOYEE (see assign-person.ts).
      const assignedProfileId = await resolveAssignedProfileId(assignValue, false);
      const res = await fetch("/api/org-nodes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          parent_id: parentId || null,
          assigned_profile_id: assignedProfileId,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Failed to create position");

      toast.success(t("common.success"));
      reset();
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("org.addPosition", "Add Position")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("org.positionTitle", "Position title")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
          </div>

          <div className="space-y-2">
            <Label>{t("org.parentNodeOptional", "Parent node (optional)")}</Label>
            <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("org.noParent", "None (top-level)")}</SelectItem>
                {allNodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t("org.assignNowOptional", "Assign person now (optional)")}</Label>
            <AssignPersonPicker
              unassignedProfiles={unassignedProfiles}
              value={assignValue}
              onChange={setAssignValue}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("org.createPosition", "Create position")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
