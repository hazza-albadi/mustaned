"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/config";
import { submissionFormSchema } from "@/lib/validations";
import { isDisplayField } from "@/lib/form-fields";
import { resolveApprovalChain, resolveLegacyRequiredApprovers } from "@/lib/approval-chain";
import { FieldRenderer } from "@/components/forms/field-renderer";
import { FileUpload } from "@/components/forms/file-upload";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { FormDefinition, SubmissionFile } from "@/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface DraftShape {
  data: Record<string, unknown>;
  files: SubmissionFile[];
}

export function DynamicFormRenderer({
  form,
  userId,
  employeeDepartmentId,
  hasOrgNodeAssignment,
}: {
  form: FormDefinition;
  userId: string;
  // The submitting employee's own department — pre-fills form_submissions.department_id
  // when set. This is legacy (pre-org-tree) scaffolding, so it's fine for it to be null.
  employeeDepartmentId: string | null;
  // Whether the employee holds a position in the org tree. Routing resolves
  // through approval_chain / org_nodes, so this alone is enough to submit —
  // an employee only needs one of employeeDepartmentId or this to be set.
  hasOrgNodeAssignment: boolean;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  const sortedFields = useMemo(() => [...form.fields].sort((a, b) => a.order - b.order), [form.fields]);
  const draftKey = `draft:${form.id}:${userId}`;
  const draftIdRef = useRef(uuidv4());
  const hasRouting = Boolean(employeeDepartmentId) || hasOrgNodeAssignment;

  const [files, setFiles] = useState<SubmissionFile[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [pendingDraft, setPendingDraft] = useState<DraftShape | null>(null);

  const schema = useMemo(() => submissionFormSchema(sortedFields, locale), [sortedFields, locale]);

  const {
    control,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      data: Object.fromEntries(
        sortedFields
          .filter((f) => !isDisplayField(f.type))
          .map((f) => [f.id, f.type === "checkbox" ? [] : f.defaultValue ?? ""])
      ),
    },
  });

  const allDataValues = watch();

  // Restore draft on mount.
  useEffect(() => {
    if (!hasRouting) return;
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as DraftShape;
        setPendingDraft(parsed);
        setShowDraftPrompt(true);
      } catch {
        localStorage.removeItem(draftKey);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-save draft (debounced).
  useEffect(() => {
    if (!hasRouting) return;
    const timeout = setTimeout(() => {
      const hasContent = Object.values(allDataValues.data ?? {}).some(Boolean);
      if (hasContent) {
        localStorage.setItem(draftKey, JSON.stringify({ data: allDataValues.data, files }));
      }
    }, 800);
    return () => clearTimeout(timeout);
  }, [allDataValues, files, draftKey, hasRouting]);

  const applyDraft = () => {
    if (!pendingDraft) return;
    setValue("data", pendingDraft.data as never);
    setFiles(pendingDraft.files ?? []);
    setShowDraftPrompt(false);
  };

  const discardDraft = () => {
    localStorage.removeItem(draftKey);
    setShowDraftPrompt(false);
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!hasRouting) return;
    setSubmitting(true);
    try {
      // Resolve the approval chain to whoever currently holds each position
      // before building per-approver entries, so routing always reflects who
      // holds that role today rather than who held it when the form was
      // designed. Forms saved before approval_chain existed fall back to
      // their flat required_approvers list.
      let resolvedApproverIds: string[];
      if (form.approval_chain && form.approval_chain.length > 0) {
        const resolution = await resolveApprovalChain(supabase, form.approval_chain, userId);
        if (!resolution.ok) {
          toast.error(resolution.message);
          setSubmitting(false);
          return;
        }
        resolvedApproverIds = resolution.approverIds;
      } else {
        resolvedApproverIds = resolveLegacyRequiredApprovers(form.required_approvers ?? []);
      }

      const approvals = resolvedApproverIds.map((approverId) => ({
        approver_id: approverId,
        status: "PENDING" as const,
        comment: null,
        decided_at: null,
      }));

      const { error } = await supabase.from("form_submissions").insert({
        form_id: form.id,
        submitted_by: userId,
        department_id: employeeDepartmentId,
        data: values.data,
        files,
        status: "PENDING",
        approvals,
        draft_id: draftIdRef.current,
      });

      if (error) throw error;

      localStorage.removeItem(draftKey);
      toast.success(t("fill.submitSuccess"));
      router.push("/forms");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(t("fill.submitError"));
    } finally {
      setSubmitting(false);
    }
  });

  const title = locale === "ar" && form.title_ar ? form.title_ar : form.title;
  const description =
    locale === "ar" && form.description_ar ? form.description_ar : form.description;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <AlertDialog open={showDraftPrompt} onOpenChange={setShowDraftPrompt}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("fill.draftSaved")}</AlertDialogTitle>
            <AlertDialogDescription>{t("fill.continueDraft")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={discardDraft}>{t("fill.discardDraft")}</AlertDialogCancel>
            <AlertDialogAction onClick={applyDraft}>{t("fill.loadDraft")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>

      {!hasRouting ? (
        <Alert variant="destructive">
          <AlertDescription>{t("fill.noDepartmentError")}</AlertDescription>
        </Alert>
      ) : (
        <form onSubmit={onSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t("fill.step2Title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {sortedFields.map((field) => (
                <FieldRenderer key={field.id} field={field} control={control} errors={errors} />
              ))}

              <div className="space-y-2">
                <Label>{t("fill.attachments")}</Label>
                <FileUpload
                  userId={userId}
                  draftId={draftIdRef.current}
                  value={files}
                  onChange={setFiles}
                />
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={submitting} className="w-full" size="lg">
            {submitting && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {submitting ? t("common.submitting") : t("common.submit")}
          </Button>
        </form>
      )}
    </div>
  );
}
