import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { filterSchema } from "@/lib/validations";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Same shape as requireManageFormsAccess() in src/app/api/forms/route.ts,
// gated on manage_filters instead — see that file's comment for the
// session-client/RLS reasoning.
async function requireManageFiltersAccess() {
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
      .eq("permission", "manage_filters")
      .maybeSingle();
    if (perm) return { supabase, user };
  }
  return null;
}

export async function POST(request: Request) {
  if (!(await rateLimitAsync(`filters:create:${getClientIp(request)}`, 30, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireManageFiltersAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const parsed = filterSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data, error } = await caller.supabase.from("filters").insert(parsed.data).select("*").single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag("filters");

  return NextResponse.json(data, { status: 201 });
}
