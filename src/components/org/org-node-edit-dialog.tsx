"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
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
import type { FormDefinition, OrgNode, Profile } from "@/types";
import { Copy, Loader2, Trash2, UserMinus, Ban, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

function computeDescendantIds(nodeId: string, allNodes: OrgNode[]): Set<string> {
  const childrenOf = new Map<string, string[]>();
  for (const n of allNodes) {
    if (!n.parent_id) continue;
    childrenOf.set(n.parent_id, [...(childrenOf.get(n.parent_id) ?? []), n.id]);
  }
  const result = new Set<string>();
  const stack = [...(childrenOf.get(nodeId) ?? [])];
  while (stack.length > 0) {
    const current = stack.pop()!;
    if (result.has(current)) continue;
    result.add(current);
    stack.push(...(childrenOf.get(current) ?? []));
  }
  return result;
}

export function OrgNodeEditDialog({
  node,
  allNodes,
  profileMap,
  unassignedProfiles,
  forms,
  open,
  onOpenChange,
}: {
  node: OrgNode | null;
  allNodes: OrgNode[];
  profileMap: Map<string, Profile>;
  unassignedProfiles: Profile[];
  forms: Pick<FormDefinition, "id" | "title" | "approval_chain">[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [parentId, setParentId] = useState("");
  const [personName, setPersonName] = useState("");
  const [personEmail, setPersonEmail] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignValue, setAssignValue] = useState<AssignPersonValue>({ mode: "none" });
  const [busy, setBusy] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const assignedProfile = node?.assigned_profile_id ? profileMap.get(node.assigned_profile_id) : null;

  useEffect(() => {
    if (open && node) {
      setTitle(node.title);
      setParentId(node.parent_id ?? "");
      setPersonName(assignedProfile?.name ?? "");
      setPersonEmail(assignedProfile?.email ?? "");
      setAssigning(false);
      setAssignValue({ mode: "none" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, node]);

  if (!node) return null;

  const excludedParentIds = computeDescendantIds(node.id, allNodes);
  excludedParentIds.add(node.id);
  const parentOptions = allNodes.filter((n) => !excludedParentIds.has(n.id));
  const referencingForms = forms.filter((f) =>
    (f.approval_chain ?? []).some((step) => step.type === "node" && step.node_id === node.id)
  );

  async function saveChanges() {
    setBusy(true);
    try {
      const res = await fetch(`/api/org-nodes/${node!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, parent_id: parentId || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("common.error"));

      if (assignedProfile && (personName !== assignedProfile.name || personEmail !== assignedProfile.email)) {
        const personRes = await fetch(`/api/users/${assignedProfile.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: personName,
            name_ar: assignedProfile.name_ar ?? "",
            email: personEmail,
            role: assignedProfile.role,
          }),
        });
        const personBody = await personRes.json().catch(() => ({}));
        if (!personRes.ok) throw new Error(personBody.error ?? t("common.error"));
      }

      toast.success(t("common.success"));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function confirmAssign() {
    setBusy(true);
    try {
      const hasChildren = allNodes.some((n) => n.parent_id === node!.id && n.is_active);
      const profileId = await resolveAssignedProfileId(assignValue, hasChildren);
      if (!profileId) {
        toast.error(t("common.error"));
        return;
      }
      const res = await fetch(`/api/org-nodes/${node!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_profile_id: profileId }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("common.error"));
      toast.success(t("common.success"));
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setBusy(false);
    }
  }

  async function unassign() {
    setBusy(true);
    const res = await fetch(`/api/org-nodes/${node!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_profile_id: null }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? t("common.error"));
      return;
    }
    toast.success(t("common.success"));
    router.refresh();
  }

  async function toggleActive() {
    setBusy(true);
    const res = await fetch(`/api/org-nodes/${node!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !node!.is_active }),
    });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? t("common.error"));
      return;
    }
    toast.success(t("common.success"));
    router.refresh();
  }

  async function confirmDelete() {
    setBusy(true);
    const res = await fetch(`/api/org-nodes/${node!.id}`, { method: "DELETE" });
    setBusy(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      toast.error(body.error ?? t("common.error"));
      return;
    }
    toast.success(t("common.success"));
    setConfirmDeleteOpen(false);
    onOpenChange(false);
    router.refresh();
  }

  function copyId() {
    navigator.clipboard.writeText(node!.id);
    toast.success(t("common.success"));
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("org.editPosition", "Edit Position")}</SheetTitle>
          </SheetHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-2">
              <Label>{t("org.positionTitle", "Position title")}</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>{t("org.nodeId", "Node ID")}</Label>
              <div className="flex gap-2">
                <Input value={node.id} readOnly className="font-mono text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyId}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t("org.parentNode", "Parent node")}</Label>
              <Select value={parentId || "none"} onValueChange={(v) => setParentId(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("org.noParent", "None (top-level)")}</SelectItem>
                  {parentOptions.map((n) => (
                    <SelectItem key={n.id} value={n.id}>
                      {n.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 rounded-md border p-3">
              <Label>{t("org.assignedPerson", "Assigned person")}</Label>

              {assignedProfile ? (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t("common.name")}</Label>
                      <Input value={personName} onChange={(e) => setPersonName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground">{t("common.email")}</Label>
                      <Input
                        type="email"
                        value={personEmail}
                        onChange={(e) => setPersonEmail(e.target.value)}
                      />
                    </div>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={unassign} disabled={busy}>
                    <UserMinus className="h-3.5 w-3.5" /> {t("org.unassignPerson", "Unassign person")}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{t("org.noPersonAssigned", "No person assigned")}</p>
                  {!assigning ? (
                    <Button type="button" size="sm" onClick={() => setAssigning(true)}>
                      {t("org.assignPerson", "Assign Person")}
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      <AssignPersonPicker
                        unassignedProfiles={unassignedProfiles}
                        value={assignValue}
                        onChange={setAssignValue}
                      />
                      <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setAssigning(false)}>
                          {t("common.cancel")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={confirmAssign}
                          disabled={busy || assignValue.mode === "none"}
                        >
                          {busy && <Loader2 className="me-1 h-3.5 w-3.5 animate-spin" />}
                          {t("org.confirmAssignment", "Confirm assignment")}
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={toggleActive} disabled={busy}>
                {node.is_active ? <Ban className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                {node.is_active ? t("org.deactivate", "Deactivate") : t("org.reactivate", "Reactivate")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1 text-red-500 hover:text-red-600"
                onClick={() => setConfirmDeleteOpen(true)}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" /> {t("common.delete")}
              </Button>
            </div>
          </div>

          <SheetFooter className="flex-row justify-end gap-2 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="button" onClick={saveChanges} disabled={busy}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("org.saveChanges", "Save changes")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common.delete")} &ldquo;{node.title}&rdquo;?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the position. Any child positions become top-level.
              {referencingForms.length > 0 && (
                <span className="mt-2 block font-medium text-yellow-700">
                  Warning: referenced in {referencingForms.length} form
                  {referencingForms.length > 1 ? "s" : ""} approval chain
                  {referencingForms.length > 1 ? "s" : ""} ({referencingForms.map((f) => f.title).join(", ")}
                  ). Those forms will be blocked at submission until updated.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={busy}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
