import type { AdminPermission, Role } from "@/types";

// The landing page for each role, used by the root page, login redirect,
// and as the fallback destination when a role-gated page/route is denied.
// ADMIN's entry here is just a static baseline (used e.g. for the post-login
// bounce from /login) — resolveAdminHome() below is the permission-aware
// version used everywhere the exact destination actually matters.
export const ROLE_HOME: Record<Role, string> = {
  EMPLOYEE: "/forms",
  DEPARTMENT_HEAD: "/forms",
  ADMIN: "/admin",
  SUPER_ADMIN: "/admin",
};

// Priority order for both "which page do we send a freshly-permissioned ADMIN
// to" and nav rendering — matches the real /admin pages one-to-one.
export const ADMIN_PERMISSION_PRIORITY: AdminPermission[] = [
  "view_submissions",
  "manage_forms",
  "manage_org_chart",
  "view_analytics",
];

export const ADMIN_PERMISSION_HOME: Record<AdminPermission, string> = {
  view_submissions: "/admin",
  manage_forms: "/admin/builder",
  manage_org_chart: "/admin/org",
  view_analytics: "/admin/analytics",
};

// The first page an ADMIN can actually use, in priority order — or the
// no-access page if they currently hold zero permissions. Used any time an
// ADMIN is denied a page and needs somewhere real to land instead of a loop.
export function resolveAdminHome(permissions: AdminPermission[]): string {
  for (const permission of ADMIN_PERMISSION_PRIORITY) {
    if (permissions.includes(permission)) return ADMIN_PERMISSION_HOME[permission];
  }
  return "/admin/no-access";
}
