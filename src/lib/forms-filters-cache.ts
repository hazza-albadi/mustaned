import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import type { Filter, FormDefinition } from "@/types";

// Same pattern as src/lib/org-nodes-cache.ts — see that file for the full
// rationale. Short version: `forms`/`filters` (active rows only) are the
// highest-traffic reads in the app (every employee hits /forms constantly)
// but were identical for every caller and re-queried on every single
// request. Both tables' "everyone can view active X" RLS policies
// (0001_init.sql, 0011_add_filters.sql) don't check auth.uid() at all, so
// the row set genuinely doesn't vary by caller — using the service-role
// client here isn't a new access boundary, just a cache key that doesn't
// need to vary per session. unstable_cache can't read cookies()
// internally, which is the other reason this can't just wrap the
// session-scoped client.
//
// Unlike org_nodes, these two tables' writes used to happen via direct
// client-side supabase.from(...) calls with no server-side hook to
// invalidate from — see POST/PATCH /api/forms(/[id]) and
// /api/filters(/[id]), which now call revalidateTag("forms")/
// revalidateTag("filters") on every write, same as org-nodes.
export const getActiveForms = unstable_cache(
  async (): Promise<FormDefinition[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("forms")
      .select("*")
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    return (data ?? []) as FormDefinition[];
  },
  ["forms-active"],
  { tags: ["forms"], revalidate: 60 }
);

export const getActiveFilters = unstable_cache(
  async (): Promise<Filter[]> => {
    const admin = createAdminClient();
    const { data } = await admin.from("filters").select("*").eq("is_active", true).order("name");
    return (data ?? []) as Filter[];
  },
  ["filters-active"],
  { tags: ["filters"], revalidate: 60 }
);
