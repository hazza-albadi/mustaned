import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import type { OrgNode } from "@/types";

// Caching audit finding: org_nodes (the org chart) is read on every page that
// renders /admin/org, /admin/builder/[formId] (position picker),
// /admin/analytics, /admin/signups (position picker + handoff view), and
// /fill/[formId] (a single row, filtered by the caller's own id) — up to
// five separate DB round trips for data that's identical for every caller
// and changes only when an admin edits the chart. RLS on org_nodes varies by
// role (0007_admin_permissions.sql), but every one of these read sites is
// already gated by an app-layer permission/role check *before* it queries,
// so — same reasoning as the admin/signups approver-name lookup — using the
// service-role client here isn't a new access boundary, just a shared cache
// key that doesn't have to vary by caller.
//
// unstable_cache is used (not a route-level `revalidate` export) because
// every page reading this data must stay `force-dynamic` for its own
// auth/session logic; unstable_cache lets just this one query be cached
// independently of that. It can't read cookies()/headers() internally (Next
// disallows that inside a cached function), which is exactly why this uses
// createAdminClient() rather than the per-request session client.
//
// revalidate: 60 is a bounded staleness window in case a write-path ever
// misses its revalidateTag call; the four real mutation entry points
// (POST /api/org-nodes, PATCH+DELETE /api/org-nodes/[id], and the org_nodes
// update inside POST /api/signups/[id]/approve) all call
// revalidateTag("org-nodes") on success, so in practice an edit is visible
// immediately, not after 60s.
export const getAllOrgNodes = unstable_cache(
  async (): Promise<OrgNode[]> => {
    const admin = createAdminClient();
    const { data } = await admin.from("org_nodes").select("*").order("created_at", { ascending: true });
    return (data ?? []) as OrgNode[];
  },
  ["org-nodes-all"],
  { tags: ["org-nodes"], revalidate: 60 }
);
