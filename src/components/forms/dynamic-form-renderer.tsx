"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import { useI18n } from "@/lib/i18n/config";
import { submissionFormSchema } from "@/lib/validations";
import { isDisplayField } from "@/lib/form-fields";
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
  hasOrgNodeAssignment,
}: {
  form: FormDefinition;
  userId: string;
  // Whether the employee holds a position in the org tree. Routing resolves
  // through approval_chain / org_nodes, so this is required to submit.
  hasOrgNodeAssignment: boolean;
}) {
  const { locale, t } = useI18n();
  const router = useRouter();
  const sortedFields = useMemo(() => [...form.fields].sort((a, b) => a.order - b.order), [form.fields]);
  const draftKey = `draft:${form.id}:${userId}`;
  const draftIdRef = useRef(uuidv4());
  const hasRouting = hasOrgNodeAssignment;

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
      // Submission creation, form-schema re-validation, and approval-chain
      // resolution all happen server-side now (src/app/api/submissions/route.ts)
      // so a direct client insert can no longer forge status/approvals/
      // approver_id — this call is just the transport.
      const res = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_id: form.id,
          data: values.data,
          files,
          draft_id: draftIdRef.current,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? t("fill.submitError"));

      localStorage.removeItem(draftKey);
      toast.success(t("fill.submitSuccess"));
      router.push("/forms");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : t("fill.submitError"));
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
