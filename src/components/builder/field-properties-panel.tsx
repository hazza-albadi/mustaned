"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n/config";
import { createClient } from "@/lib/supabase/client";
import { FIELD_TYPES, MAX_FILE_SIZE_BYTES } from "@/lib/form-fields";
import type { FormField } from "@/types";
import { ChevronDown, ChevronUp, Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";

// Re-encodes any uploaded image through <canvas> before it's stored, always
// producing a baseline JPEG — canvas.toBlob() never emits progressive JPEG
// in any browser. This is the root-cause fix for @react-pdf/renderer's
// bundled decoder hanging indefinitely on progressive JPEGs when the image
// is later embedded in a submission PDF export.
async function reencodeAsBaselineJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is not supported in this browser");
    // JPEG has no alpha channel — flatten onto white first so a transparent
    // source (e.g. a PNG) doesn't end up with a black background.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob) throw new Error("Failed to re-encode image");
    return blob;
  } finally {
    bitmap.close();
  }
}

function sanitizeToJpgName(name: string): string {
  return `${name.replace(/\.[^./\\]+$/, "").replace(/[^a-zA-Z0-9-_]+/g, "-")}.jpg`;
}

export function FieldPropertiesPanel({
  field,
  onChange,
  userId,
}: {
  field: FormField | null;
  onChange: (updates: Partial<FormField>) => void;
  userId: string;
}) {
  const { t } = useI18n();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  if (!field) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        {t("builder.selectField")}
      </div>
    );
  }

  const hasOptions = FIELD_TYPES.find((f) => f.type === field.type)?.hasOptions ?? false;
  const isSectionHeading = field.type === "section_heading";
  const isImageBlock = field.type === "image_block";
  const isTable = field.type === "table";
  const isDisplayOnly = isSectionHeading || isImageBlock;

  async function handleImageFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !field) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("builder.imageFileRequired"));
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      toast.error(t("builder.imageTooLarge"));
      return;
    }

    setUploadingImage(true);
    try {
      const jpeg = await reencodeAsBaselineJpeg(file);
      const path = `field-images/${userId}/${field.id}/${Date.now()}-${sanitizeToJpgName(file.name)}`;
      const { error: uploadError } = await supabase.storage.from("form-files").upload(path, jpeg, {
        upsert: false,
        contentType: "image/jpeg",
      });
      if (uploadError) throw uploadError;

      const { data: urlData, error: urlError } = await supabase.storage
        .from("form-files")
        .createSignedUrl(path, 60 * 60 * 24 * 365);
      if (urlError || !urlData) throw urlError ?? new Error("Failed to create signed URL");

      onChange({ defaultValue: urlData.signedUrl });
    } catch (err) {
      console.error(err);
      toast.error(t("builder.imageUploadFailed"));
    } finally {
      setUploadingImage(false);
    }
  }

  const updateOption = (index: number, value: string) => {
    const options = [...field.options];
    options[index] = value;
    onChange({ options });
  };

  const addOption = () => {
    onChange({ options: [...field.options, `Option ${field.options.length + 1}`] });
  };

  const removeOption = (index: number) => {
    onChange({ options: field.options.filter((_, i) => i !== index) });
  };

  const updateColumn = updateOption;
  const addColumn = () => {
    onChange({ options: [...field.options, `Column ${field.options.length + 1}`] });
  };
  const removeColumn = removeOption;
  const moveColumn = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= field.options.length) return;
    const options = [...field.options];
    [options[index], options[target]] = [options[target], options[index]];
    onChange({ options });
  };

  return (
    <div className="space-y-5 p-1">
      <h3 className="text-sm font-semibold text-muted-foreground">{t("builder.fieldProperties")}</h3>

      {!isImageBlock && (
        <>
          <div className="space-y-2">
            <Label>{isSectionHeading ? t("builder.headingText") : t("builder.label")}</Label>
            <Input value={field.label} onChange={(e) => onChange({ label: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>{t("builder.labelAr")}</Label>
            <Input value={field.label_ar} onChange={(e) => onChange({ label_ar: e.target.value })} dir="rtl" />
          </div>
        </>
      )}

      {(field.type === "text" ||
        field.type === "textarea" ||
        field.type === "number" ||
        field.type === "email") && (
        <>
          <div className="space-y-2">
            <Label>{t("builder.placeholder")}</Label>
            <Input
              value={field.placeholder}
              onChange={(e) => onChange({ placeholder: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("builder.placeholderAr")}</Label>
            <Input
              value={field.placeholder_ar}
              onChange={(e) => onChange({ placeholder_ar: e.target.value })}
              dir="rtl"
            />
          </div>
        </>
      )}

      {isSectionHeading && (
        <div className="space-y-2">
          <Label>{t("builder.headingDescription")}</Label>
          <Textarea
            value={field.description}
            onChange={(e) => onChange({ description: e.target.value })}
          />
        </div>
      )}

      {isImageBlock && (
        <>
          <div className="space-y-2">
            <Label>{t("builder.imageUrl")}</Label>
            <Input
              value={typeof field.defaultValue === "string" ? field.defaultValue : ""}
              onChange={(e) => onChange({ defaultValue: e.target.value })}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleImageFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
            >
              {uploadingImage ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Upload className="h-3.5 w-3.5" />
              )}
              {t("builder.uploadImage")}
            </Button>
          </div>

          {typeof field.defaultValue === "string" && field.defaultValue && (
            // eslint-disable-next-line @next/next/no-img-element -- user-provided external URL
            <img
              src={field.defaultValue}
              alt=""
              className="max-h-32 w-full rounded-md border object-contain"
            />
          )}

          <div className="space-y-2">
            <Label>{t("builder.caption")}</Label>
            <Input
              value={field.description}
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </div>
        </>
      )}

      {!isDisplayOnly && (
        <div className="flex items-center justify-between">
          <Label htmlFor="field-required">{t("builder.requiredField")}</Label>
          <Switch
            id="field-required"
            checked={field.required}
            onCheckedChange={(checked) => onChange({ required: checked })}
          />
        </div>
      )}

      {hasOptions && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label>{t("builder.options")}</Label>
            {field.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input value={opt} onChange={(e) => updateOption(i, e.target.value)} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeOption(i)}
                  disabled={field.options.length <= 1}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addOption}>
              <Plus className="h-3 w-3" /> {t("builder.addOption")}
            </Button>
          </div>
        </>
      )}

      {isTable && (
        <>
          <Separator />
          <div className="space-y-2">
            <Label>{t("builder.columns", "Columns")}</Label>
            {field.options.map((col, i) => (
              <div key={i} className="flex items-center gap-1">
                <Input value={col} onChange={(e) => updateColumn(i, e.target.value)} />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => moveColumn(i, -1)}
                  disabled={i === 0}
                  aria-label="Move column up"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => moveColumn(i, 1)}
                  disabled={i === field.options.length - 1}
                  aria-label="Move column down"
                >
                  <ChevronDown className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => removeColumn(i)}
                  disabled={field.options.length <= 1}
                  aria-label="Remove column"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" className="gap-1" onClick={addColumn}>
              <Plus className="h-3 w-3" /> {t("builder.addColumn", "Add column")}
            </Button>
          </div>
        </>
      )}

      {field.type === "number" && (
        <>
          <Separator />
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>Min</Label>
              <Input
                type="number"
                value={field.validation.min ?? ""}
                onChange={(e) =>
                  onChange({
                    validation: {
                      ...field.validation,
                      min: e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Max</Label>
              <Input
                type="number"
                value={field.validation.max ?? ""}
                onChange={(e) =>
                  onChange({
                    validation: {
                      ...field.validation,
                      max: e.target.value === "" ? null : Number(e.target.value),
                    },
                  })
                }
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
