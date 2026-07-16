import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildDynamicSchema } from "@/lib/validations";
import { resolveApprovalChain, resolveLegacyRequiredApprovers } from "@/lib/approval-chain";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import type { FormDefinition } from "@/types";

// S-01 fix: submission creation used to go straight from the browser to
// Supabase via the anon-key session client, with status/approvals/
// approver_id fully attacker-controlled (RLS only checked `submitted_by`).
// This route is now the sole path: it re-validates `data` against the
// form's own field schema server-side and re-resolves the approval chain
// server-side, so a forged "already approved" submission can no longer be
// crafted client-side. The INSERT still goes through the caller's own
// session client (not the service-role client) so the tightened RLS policy
// ("Employees insert own submissions") remains a real second gate, not just
// this route's say-so.
const submissionRequestSchema = z.object({
  form_id: z.string().uuid(),
  data: z.record(z.string(), z.unknown()),
  files: z.array(
    z.object({
      name: z.string(),
      url: z.string(),
      size: z.number(),
      type: z.string(),
    })
  ),
  draft_id: z.string().uuid(),
});

export async function POST(request: Request) {
  if (!(await rateLimitAsync(`submissions:create:${getClientIp(request)}`, 30, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = submissionRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { form_id, data, files, draft_id } = parsed.data;

  const { data: form, error: formError } = await supabase
    .from("forms")
    .select("*")
    .eq("id", form_id)
    .eq("is_active", true)
    .single();
  if (formError || !form) {
    return NextResponse.json({ error: "Form not found" }, { status: 404 });
  }

  const typedForm = form as FormDefinition;

  // Re-validate against the form's own field definitions server-side. The
  // client's react-hook-form/zodResolver check (buildDynamicSchema in
  // dynamic-form-renderer.tsx) is a UX affordance only — it never protects
  // against a direct fetch/curl call to this route.
  const dynamicSchema = buildDynamicSchema(typedForm.fields);
  const dataResult = dynamicSchema.safeParse(data);
  if (!dataResult.success) {
    return NextResponse.json(
      { error: dataResult.error.issues[0]?.message ?? "Invalid form data" },
      { status: 400 }
    );
  }

  let approverIds: string[];
  if (typedForm.approval_chain && typedForm.approval_chain.length > 0) {
    const resolution = await resolveApprovalChain(supabase, typedForm.approval_chain, user.id);
    if (!resolution.ok) {
      return NextResponse.json({ error: resolution.message }, { status: 400 });
    }
    approverIds = resolution.approverIds;
  } else {
    approverIds = resolveLegacyRequiredApprovers(typedForm.required_approvers ?? []);
  }

  const approvals = approverIds.map((approver_id) => ({
    approver_id,
    status: "PENDING" as const,
    comment: null,
    decided_at: null,
  }));

  const { data: created, error } = await supabase
    .from("form_submissions")
    .insert({
      form_id,
      submitted_by: user.id,
      data: dataResult.data as Record<string, unknown>,
      files,
      status: "PENDING",
      approver_id: null,
      approved_at: null,
      approvals,
      draft_id,
    })
    .select("id")
    .single();

  if (error || !created) {
    return NextResponse.json({ error: error?.message ?? "Failed to submit" }, { status: 400 });
  }

  return NextResponse.json({ id: created.id }, { status: 201 });
}
