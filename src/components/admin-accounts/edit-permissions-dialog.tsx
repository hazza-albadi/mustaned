"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ADMIN_PERMISSION_OPTIONS } from "@/lib/admin-permission-options";
import type { AdminPermission, Profile } from "@/types";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

// Edit-only — replaces the full permission set for an existing Admin
// account. Never touches name/email/password.
export function EditPermissionsDialog({
  admin,
  currentPermissions,
  open,
  onOpenChange,
}: {
  admin: Profile | null;
  currentPermissions: AdminPermission[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setPermissions(currentPermissions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, admin]);

  function togglePermission(value: AdminPermission) {
    setPermissions((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!admin) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin-accounts/${admin.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("common.error"));

      toast.success(t("common.success"));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  if (!admin) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("admin.editPermissions", "Edit permissions")} — {admin.name}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2 rounded-md border p-3">
            {ADMIN_PERMISSION_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={permissions.includes(opt.value)}
                  onCheckedChange={() => togglePermission(opt.value)}
                />
                {t(opt.labelKey)}
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              {t("common.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
