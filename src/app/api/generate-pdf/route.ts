import { NextResponse } from "next/server";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { rateLimitAsync, getClientIp } from "@/lib/rate-limit";
import { resolveSubmissionFields } from "@/lib/submission-fields";
import { getApprovedApprovers } from "@/lib/approver-summary";
import { resolveOrgPosition, formatPositionLabel, type OrgNodeLite } from "@/lib/org-position";
import { renderSubmissionPdf, buildSubmissionPdfFileName, type SubmissionPdfData } from "@/lib/pdf/submission-pdf";
import type { Locale } from "@/lib/i18n/config";
import type { FormSubmissionWithRelations, Profile } from "@/types";

// PDF generation runs @react-pdf/renderer server-side (Node), which needs
// fs access for the logo and has no CSP/Worker restrictions to work around —
// this route replaces the old client-side generation entirely.
export async function POST(request: Request) {
  if (!(await rateLimitAsync(`generate-pdf:${getClientIp(request)}`, 20, 60_000))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const profile = await getCurrentProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const submissionId = typeof body?.submissionId === "string" ? body.submissionId : null;
  const locale: Locale = body?.locale === "ar" ? "ar" : "en";
  if (!submissionId) return NextResponse.json({ error: "Invalid input" }, { status: 400 });

  // Session-scoped client — RLS decides whether this caller can see the
  // submission at all, same as every other read in this app.
  const supabase = await createClient();

  const { data: submission } = await supabase
    .from("form_submissions")
    .select(
      "*, form:forms(id,title,title_ar,fields), submitter:profiles!form_submissions_submitted_by_fkey(id,name,name_ar,email)"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (!submission) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sub = submission as unknown as FormSubmissionWithRelations;

  if (sub.status !== "APPROVED") {
    return NextResponse.json({ error: "Only approved submissions can be exported" }, { status: 400 });
  }

  const approverIds = Array.from(
    new Set([...sub.approvals.map((a) => a.approver_id), ...(sub.approver_id ? [sub.approver_id] : [])])
  );

  const [{ data: approverProfiles }, { data: orgNodeRows }] = await Promise.all([
    approverIds.length > 0
      ? supabase.from("profiles").select("id, name, name_ar").in("id", approverIds)
      : Promise.resolve({ data: [] as Pick<Profile, "id" | "name" | "name_ar">[] }),
    supabase.from("org_nodes").select("id, title, parent_id, assigned_profile_id").eq("is_active", true),
  ]);

  const approvers = (approverProfiles ?? []) as Pick<Profile, "id" | "name" | "name_ar">[];
  const orgNodes = (orgNodeRows ?? []) as OrgNodeLite[];

  const formTitle = (locale === "ar" && sub.form?.title_ar ? sub.form.title_ar : sub.form?.title) ?? "Form";
  const fields = resolveSubmissionFields(sub.form?.fields, sub.data, locale);

  const employeePositionLabel = formatPositionLabel(resolveOrgPosition(sub.submitted_by, orgNodes), locale);

  const approverEntries = getApprovedApprovers(sub).map(({ id, date }) => {
    const p = approvers.find((a) => a.id === id);
    const name = p ? ((locale === "ar" && p.name_ar ? p.name_ar : p.name) ?? id) : id;
    const positionLabel = formatPositionLabel(resolveOrgPosition(id, orgNodes), locale);
    return {
      name,
      positionLabel,
      date: date ? format(new Date(date), "PPP") : null,
    };
  });

  const data: SubmissionPdfData = {
    formTitle,
    submissionId: sub.id,
    submittedAt: format(new Date(sub.created_at), "PPP p"),
    employeeName:
      (locale === "ar" && sub.submitter?.name_ar ? sub.submitter.name_ar : sub.submitter?.name) ?? "—",
    employeePositionLabel,
    employeeEmail: sub.submitter?.email ?? "—",
    approvers: approverEntries,
    fields,
    files: sub.files ?? [],
  };

  const blob = await renderSubmissionPdf(data);
  const fileName = buildSubmissionPdfFileName(formTitle, sub.id);

  return new NextResponse(blob, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
