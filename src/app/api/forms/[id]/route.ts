import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { formBuilderSchema } from "@/lib/validations";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";

// Same gate as ../route.ts (POST) — see its comment.
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

// Covers both a full builder save (form-builder.tsx's persist(), the whole
// formBuilderSchema shape) and the standalone archive toggle
// (form-builder.tsx's archiveForm(), just { is_active: false }) — .partial()
// so either shape validates.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await rateLimitAsync(`forms:update:${getClientIp(request)}`, 60, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireManageFormsAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = formBuilderSchema.partial().safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }

  const { data, error } = await caller.supabase
    .from("forms")
    .update(parsed.data)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  revalidateTag("forms");

  return NextResponse.json(data);
}

// Hard delete — matches forms-list.tsx's existing behavior exactly.
// form_submissions.form_id references forms(id) on delete cascade
// (0001_init.sql), so this also deletes every submission ever made against
// this form. That's pre-existing behavior, unchanged by this route move —
// flagged separately as a health-check finding, not something to alter here.
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await rateLimitAsync(`forms:delete:${getClientIp(request)}`, 30, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const caller = await requireManageFormsAccess();
  if (!caller) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const { error } = await caller.supabase.from("forms").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  revalidateTag("forms");

  return NextResponse.json({ ok: true });
}
