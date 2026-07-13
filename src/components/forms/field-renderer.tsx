"use client";

import type { FieldErrors } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useI18n } from "@/lib/i18n/config";
import type { FormField as DynamicField } from "@/types";

export function FieldRenderer({
  field,
  control,
  errors,
}: {
  field: DynamicField;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  control: any;
  errors: FieldErrors;
}) {
  const { locale, t } = useI18n();
  const label = locale === "ar" && field.label_ar ? field.label_ar : field.label;
  const placeholder =
    locale === "ar" && field.placeholder_ar ? field.placeholder_ar : field.placeholder;

  // Display-only types render static content between questions — no input,
  // no label-for association, and (per buildDynamicSchema/onSubmit) nothing
  // is collected into submission.data for them, so they never touch the
  // react-hook-form Controller below.
  if (field.type === "section_heading") {
    return (
      <div className="space-y-1 pt-2">
        <h3 className="text-lg font-bold">{label}</h3>
        {field.description && <p className="text-sm text-muted-foreground">{field.description}</p>}
      </div>
    );
  }

  if (field.type === "image_block") {
    const imageUrl = typeof field.defaultValue === "string" ? field.defaultValue : "";
    if (!imageUrl) return null;
    return (
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- user-provided external URL */}
        <img src={imageUrl} alt={field.description || ""} className="max-w-full rounded-md" />
        {field.description && <p className="text-sm text-muted-foreground">{field.description}</p>}
      </div>
    );
  }

  const error = errors?.data && (errors.data as Record<string, { message?: string }>)[field.id];
  const name = `data.${field.id}`;

  return (
    <div className="space-y-2">
      {field.type !== "checkbox" && field.type !== "radio" && (
        <Label htmlFor={field.id}>
          {label}
          {field.required && <span className="ms-1 text-red-500">*</span>}
        </Label>
      )}

      <Controller
        name={name}
        control={control}
        render={({ field: rhf }) => {
          switch (field.type) {
            case "textarea":
              return (
                <Textarea
                  id={field.id}
                  placeholder={placeholder}
                  value={(rhf.value as string) ?? ""}
                  onChange={rhf.onChange}
                />
              );
            case "number":
              return (
                <Input
                  id={field.id}
                  type="number"
                  placeholder={placeholder}
                  value={(rhf.value as string) ?? ""}
                  onChange={rhf.onChange}
                />
              );
            case "email":
              return (
                <Input
                  id={field.id}
                  type="email"
                  placeholder={placeholder}
                  value={(rhf.value as string) ?? ""}
                  onChange={rhf.onChange}
                />
              );
            case "date":
              return (
                <Input
                  id={field.id}
                  type="date"
                  value={(rhf.value as string) ?? ""}
                  onChange={rhf.onChange}
                />
              );
            case "dropdown":
              return (
                <Select value={(rhf.value as string) ?? ""} onValueChange={rhf.onChange}>
                  <SelectTrigger id={field.id}>
                    <SelectValue placeholder={t("common.selectOption")} />
                  </SelectTrigger>
                  <SelectContent>
                    {field.options.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            case "radio":
              return (
                <div className="space-y-1">
                  <Label>
                    {label}
                    {field.required && <span className="ms-1 text-red-500">*</span>}
                  </Label>
                  <RadioGroup value={(rhf.value as string) ?? ""} onValueChange={rhf.onChange}>
                    {field.options.map((opt) => (
                      <div key={opt} className="flex items-center gap-2">
                        <RadioGroupItem value={opt} id={`${field.id}-${opt}`} />
                        <Label htmlFor={`${field.id}-${opt}`} className="font-normal">
                          {opt}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
              );
            case "checkbox": {
              const values: string[] = Array.isArray(rhf.value) ? rhf.value : [];
              return (
                <div className="space-y-1">
                  <Label>
                    {label}
                    {field.required && <span className="ms-1 text-red-500">*</span>}
                  </Label>
                  {field.options.map((opt) => (
                    <div key={opt} className="flex items-center gap-2">
                      <Checkbox
                        id={`${field.id}-${opt}`}
                        checked={values.includes(opt)}
                        onCheckedChange={(checked) => {
                          rhf.onChange(
                            checked ? [...values, opt] : values.filter((v) => v !== opt)
                          );
                        }}
                      />
                      <Label htmlFor={`${field.id}-${opt}`} className="font-normal">
                        {opt}
                      </Label>
                    </div>
                  ))}
                </div>
              );
            }
            case "file":
              return (
                <Input
                  id={field.id}
                  type="file"
                  onChange={(e) => rhf.onChange(e.target.files?.[0]?.name ?? "")}
                />
              );
            case "text":
            default:
              return (
                <Input
                  id={field.id}
                  type="text"
                  placeholder={placeholder}
                  value={(rhf.value as string) ?? ""}
                  onChange={rhf.onChange}
                />
              );
          }
        }}
      />

      {error?.message && <p className="text-sm text-red-500">{String(error.message)}</p>}
    </div>
  );
}
