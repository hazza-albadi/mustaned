import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formBuilderSchema } from "@/lib/validations";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Super Admin always passes; an Admin passes only with manage_forms. Same
// shape as requireOrgChartAccess() in src/app/api/org-nodes/route.ts — RLS
// on forms (0007_admin_permissions.sql) enforces the same rule again at the
// data layer (the write below goes through the caller's own session client,
// not the service-role client, specifically so that stays true) — this is
// just the fast, explicit application-level gate in front of it.
async function requireManageFormsAccess() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: caller } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role === "SUPER_ADMIN") return { supabase, user };
  if (caller?.role === "ADMIN") {
    const { data: perm } = await supabase
      .from("admin_permissions")
      .select("permission")
      .eq("profile_id", user.id)
      .eq("permission", "manage_forms")
      .maybeSingle();
    if (perm) return { supabase, user };
  }
  return null;
}

export async function POST(request: Request) {
  if (!(await rateLimitAsync(`forms:create:${getClientIp(request)}`, 30, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireManageFormsAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = formBuilderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  // created_by comes from the authenticated caller, not the request body —
  // formBuilderSchema doesn't even include the field, so there's nothing to
  // trust from the client here.
  const { data, error } = await caller.supabase
    .from("forms")
    .insert({ ...parsed.data, created_by: caller.user.id })
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // Keeps getActiveForms()'s cache (src/lib/forms-filters-cache.ts) from
  // hiding a newly-created active form for up to its revalidate window.
  revalidateTag("forms");

  return NextResponse.json(data, { status: 201 });
}
