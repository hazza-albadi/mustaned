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
import { Loader2, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";

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
      const path = `field-images/${userId}/${field.id}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("form-files").upload(path, file, {
        upsert: false,
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
