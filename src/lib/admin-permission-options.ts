import type { AdminPermission } from "@/types";

// Shared between the create-admin dialog and the edit-permissions dialog so
// the option list/order/labels stay in one place.
export const ADMIN_PERMISSION_OPTIONS: { value: AdminPermission; labelKey: string }[] = [
  { value: "view_submissions", labelKey: "admin.permission.view_submissions" },
  { value: "manage_forms", labelKey: "admin.permission.manage_forms" },
  { value: "manage_org_chart", labelKey: "admin.permission.manage_org_chart" },
  { value: "view_analytics", labelKey: "admin.permission.view_analytics" },
];
