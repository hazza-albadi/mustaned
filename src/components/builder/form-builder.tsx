"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n/config";
import { createField } from "@/lib/form-fields";
import { formBuilderSchema } from "@/lib/validations";
import { FieldPalette } from "@/components/builder/field-palette";
import { SortableFieldItem } from "@/components/builder/sortable-field-item";
import { FieldPropertiesPanel } from "@/components/builder/field-properties-panel";
import { FormPreview } from "@/components/builder/form-preview";
import { ApprovalChainBuilder } from "@/components/builder/approval-chain-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ApprovalChainStep, FieldType, FormDefinition, FormField, OrgNode } from "@/types";
import { Eye, Save, Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";

// useDroppable MUST be called inside a rendered DndContext — hooks execute
// before JSX is returned, so calling it at the FormBuilder level puts it
// outside the DndContext that only exists in the JSX tree. Extracting into a
// child component ensures the hook runs after DndContext mounts.
function CanvasDropArea({
  children,
  isEmpty,
  emptyLabel,
}: {
  children: React.ReactNode;
  isEmpty: boolean;
  emptyLabel: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas" });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[300px] space-y-3 rounded-lg border-2 border-dashed p-4 transition-colors ${
        isOver ? "border-primary bg-primary/5" : "border-muted"
      }`}
    >
      {isEmpty && (
        <p className="py-12 text-center text-sm text-muted-foreground">{emptyLabel}</p>
      )}
      {children}
    </div>
  );
}

export function FormBuilder({
  initialForm,
  orgNodes,
  userId,
}: {
  initialForm: FormDefinition | null;
  orgNodes: OrgNode[];
  userId: string;
}) {
  const { t, locale } = useI18n();
  const router = useRouter();
  const supabase = createClient();

  const [title, setTitle] = useState(initialForm?.title ?? "");
  const [titleAr, setTitleAr] = useState(initialForm?.title_ar ?? "");
  const [description, setDescription] = useState(initialForm?.description ?? "");
  const [descriptionAr, setDescriptionAr] = useState(initialForm?.description_ar ?? "");
  const [fields, setFields] = useState<FormField[]>(initialForm?.fields ?? []);
  // Legacy flat approver list — preserved as-is on save (no longer editable
  // from this UI); required only so old forms aren't silently wiped when
  // re-saved through the builder.
  const requiredApprovers = initialForm?.required_approvers ?? [];
  const [approvalChain, setApprovalChain] = useState<ApprovalChainStep[]>(
    initialForm?.approval_chain ?? []
  );
  const [requiresApproval, setRequiresApproval] = useState(initialForm?.requires_approval ?? true);
  const [requiresComment, setRequiresComment] = useState(initialForm?.requires_comment ?? true);
  const [isActive, setIsActive] = useState(initialForm?.is_active ?? true);

  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(fields[0]?.id ?? null);
  const [activeDragType, setActiveDragType] = useState<FieldType | null>(null);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);

  const selectedField = fields.find((f) => f.id === selectedFieldId) ?? null;
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const sortedFields = useMemo(() => [...fields].sort((a, b) => a.order - b.order), [fields]);

  const renumbered = (list: FormField[]) => list.map((f, i) => ({ ...f, order: i }));

  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as { isPalette?: boolean; fieldType?: FieldType } | undefined;
    if (data?.isPalette) setActiveDragType(data.fieldType ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveDragType(null);
    if (!over) return;

    const activeData = active.data.current as { isPalette?: boolean; fieldType?: FieldType } | undefined;

    if (activeData?.isPalette && activeData.fieldType) {
      const newField = createField(activeData.fieldType, fields.length);
      const overIndex = sortedFields.findIndex((f) => f.id === over.id);
      let next: FormField[];
      if (overIndex === -1) {
        next = [...sortedFields, newField];
      } else {
        next = [...sortedFields];
        next.splice(overIndex, 0, newField);
      }
      setFields(renumbered(next));
      setSelectedFieldId(newField.id);
      return;
    }

    if (active.id !== over.id) {
      const oldIndex = sortedFields.findIndex((f) => f.id === active.id);
      const newIndex = sortedFields.findIndex((f) => f.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;
      setFields(renumbered(arrayMove(sortedFields, oldIndex, newIndex)));
    }
  }

  function updateField(id: string, updates: Partial<FormField>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...updates } : f)));
  }

  function deleteField(id: string) {
    setFields((prev) => renumbered(prev.filter((f) => f.id !== id)));
    if (selectedFieldId === id) setSelectedFieldId(null);
  }

  async function persist(publish: boolean) {
    const payload = {
      title,
      title_ar: titleAr,
      description,
      description_ar: descriptionAr,
      fields: renumbered(sortedFields),
      required_approvers: requiredApprovers,
      approval_chain: approvalChain,
      requires_approval: requiresApproval,
      requires_comment: requiresComment,
      is_active: publish ? true : isActive,
    };

    const parsed = formBuilderSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid form");
      return;
    }

    setSaving(true);
    try {
      if (initialForm) {
        const { error } = await supabase.from("forms").update(payload).eq("id", initialForm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("forms").insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
      toast.success(t("builder.savedSuccess"));
      router.push("/admin/builder");
      router.refresh();
    } catch (err) {
      console.error(err);
      toast.error(t("common.error"));
    } finally {
      setSaving(false);
    }
  }

  async function archiveForm() {
    if (!initialForm) return;
    setSaving(true);
    const { error } = await supabase.from("forms").update({ is_active: false }).eq("id", initialForm.id);
    setSaving(false);
    if (error) {
      toast.error(t("common.error"));
      return;
    }
    router.push("/admin/builder");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          {initialForm ? t("builder.editForm") : t("builder.newForm")}
        </h1>
        <div className="flex items-center gap-2">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "edit" | "preview")}>
            <TabsList>
              <TabsTrigger value="edit" className="gap-1">
                {t("common.edit")}
              </TabsTrigger>
              <TabsTrigger value="preview" className="gap-1">
                <Eye className="h-3.5 w-3.5" /> {t("common.preview")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
          {initialForm && (
            <Button variant="outline" onClick={archiveForm} disabled={saving} className="gap-1">
              <Archive className="h-4 w-4" /> {t("common.archive")}
            </Button>
          )}
          <Button onClick={() => persist(true)} disabled={saving} className="gap-1">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t("builder.saveForm")}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("common.settings")}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("builder.formTitle")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("builder.formTitleAr")}</Label>
            <Input value={titleAr} onChange={(e) => setTitleAr(e.target.value)} dir="rtl" />
          </div>
          <div className="space-y-2">
            <Label>{t("builder.description")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{t("builder.descriptionAr")}</Label>
            <Textarea value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} dir="rtl" />
          </div>

          <div className="space-y-3 sm:col-span-2">
            <div>
              <Label>{t("builder.approvalChain", "Approval Chain")}</Label>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t(
                  "builder.approvalChainHint",
                  "Each step must approve in order, resolved to whoever currently holds that position."
                )}
              </p>
            </div>
            <ApprovalChainBuilder orgNodes={orgNodes} value={approvalChain} onChange={setApprovalChain} />
          </div>

          <div className="flex items-center justify-between">
            <Label>{t("builder.requiresApproval")}</Label>
            <Switch checked={requiresApproval} onCheckedChange={setRequiresApproval} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("builder.requiresComment")}</Label>
            <Switch checked={requiresComment} onCheckedChange={setRequiresComment} />
          </div>
          <div className="flex items-center justify-between">
            <Label>{t("common.active")}</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </CardContent>
      </Card>

      {mode === "preview" ? (
        <FormPreview
          title={locale === "ar" && titleAr ? titleAr : title}
          description={(locale === "ar" && descriptionAr ? descriptionAr : description) || undefined}
          fields={sortedFields}
        />
      ) : (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr_280px]">
            <div className="rounded-lg border bg-card p-4">
              <FieldPalette />
            </div>

            <CanvasDropArea isEmpty={sortedFields.length === 0} emptyLabel={t("builder.dropFieldsHere")}>
              <SortableContext items={sortedFields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
                {sortedFields.map((field) => (
                  <SortableFieldItem
                    key={field.id}
                    field={field}
                    selected={field.id === selectedFieldId}
                    onSelect={() => setSelectedFieldId(field.id)}
                    onDelete={() => deleteField(field.id)}
                  />
                ))}
              </SortableContext>
            </CanvasDropArea>

            <div className="rounded-lg border bg-card">
              <FieldPropertiesPanel
                field={selectedField}
                onChange={(updates) => selectedField && updateField(selectedField.id, updates)}
                userId={userId}
              />
            </div>
          </div>

          <DragOverlay>
            {activeDragType ? (
              <div className="rounded-md border bg-card px-3 py-2 text-sm shadow-lg">
                {t(`builder.fieldTypeLabels.${activeDragType}`)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}
