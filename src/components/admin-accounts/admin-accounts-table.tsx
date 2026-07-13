"use client";

import { useState } from "react";
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
import { AdminAccountDialog } from "@/components/admin-accounts/admin-account-dialog";
import { EditPermissionsDialog } from "@/components/admin-accounts/edit-permissions-dialog";
import { ADMIN_PERMISSION_OPTIONS } from "@/lib/admin-permission-options";
import type { AdminPermission, Profile } from "@/types";
import { Plus, Pencil } from "lucide-react";

export function AdminAccountsTable({
  admins,
  permissionsByAdmin,
}: {
  admins: Profile[];
  permissionsByAdmin: Record<string, AdminPermission[]>;
}) {
  const { t } = useI18n();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Profile | null>(null);

  const labelFor = (value: AdminPermission) =>
    t(ADMIN_PERMISSION_OPTIONS.find((o) => o.value === value)?.labelKey ?? value);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t("admin.manageAdmins", "Manage Admins")}</h1>
        <Button className="gap-1" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("admin.newAdmin", "New Admin")}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("common.name")}</TableHead>
              <TableHead>{t("common.email")}</TableHead>
              <TableHead>{t("admin.permissions", "Permissions")}</TableHead>
              <TableHead>{t("common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {admins.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>{a.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(permissionsByAdmin[a.id] ?? []).length === 0 ? (
                      <span className="text-xs text-muted-foreground">{t("admin.noPermissions", "None")}</span>
                    ) : (
                      (permissionsByAdmin[a.id] ?? []).map((p) => (
                        <Badge key={p} variant="secondary" className="text-[10px]">
                          {labelFor(p)}
                        </Badge>
                      ))
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditTarget(a)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {admins.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                  {t("common.noResults")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <AdminAccountDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditPermissionsDialog
        admin={editTarget}
        currentPermissions={editTarget ? permissionsByAdmin[editTarget.id] ?? [] : []}
        open={!!editTarget}
        onOpenChange={(o) => !o && setEditTarget(null)}
      />
    </div>
  );
}
