"use client";

import { useForm } from "react-hook-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FieldRenderer } from "@/components/forms/field-renderer";
import { useI18n } from "@/lib/i18n/config";
import { isDisplayField } from "@/lib/form-fields";
import type { FormField } from "@/types";

export function FormPreview({
  title,
  description,
  fields,
}: {
  title: string;
  description?: string;
  fields: FormField[];
}) {
  const { t } = useI18n();
  const { control, formState } = useForm({
    defaultValues: {
      data: Object.fromEntries(
        fields.filter((f) => !isDisplayField(f.type)).map((f) => [f.id, f.type === "checkbox" ? [] : ""])
      ),
    },
  });

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>{title || "Untitled form"}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">
        {fields.length === 0 && (
          <p className="text-sm text-muted-foreground">{t("builder.dropFieldsHere")}</p>
        )}
        {fields
          .sort((a, b) => a.order - b.order)
          .map((field) => (
            <FieldRenderer key={field.id} field={field} control={control} errors={formState.errors} />
          ))}
      </CardContent>
    </Card>
  );
}
