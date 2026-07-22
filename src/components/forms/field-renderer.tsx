"use client";

import type { FieldErrors } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/lib/i18n/config";
import { MAX_TABLE_ROWS, MAX_TABLE_CELL_LENGTH } from "@/lib/form-fields";
import { Plus, Trash2 } from "lucide-react";
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
            case "table": {
              const columns = field.options;
              const rows: Record<string, string>[] = Array.isArray(rhf.value) ? rhf.value : [];

              const addRow = () => {
                if (rows.length >= MAX_TABLE_ROWS) return;
                rhf.onChange([...rows, Object.fromEntries(columns.map((c) => [c, ""]))]);
              };
              const removeRow = (rowIndex: number) => {
                rhf.onChange(rows.filter((_, i) => i !== rowIndex));
              };
              const updateCell = (rowIndex: number, column: string, value: string) => {
                rhf.onChange(rows.map((r, i) => (i === rowIndex ? { ...r, [column]: value } : r)));
              };

              return (
                <div className="space-y-2">
                  <div className="overflow-x-auto rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {columns.map((col) => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                          <TableHead className="w-10" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.length === 0 && (
                          <TableRow>
                            <TableCell
                              colSpan={columns.length + 1}
                              className="h-16 whitespace-normal text-center text-muted-foreground"
                            >
                              {t("fill.tableEmptyHint")}
                            </TableCell>
                          </TableRow>
                        )}
                        {rows.map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            {columns.map((col) => (
                              <TableCell key={col} className="p-1">
                                <Input
                                  value={row[col] ?? ""}
                                  onChange={(e) => updateCell(rowIndex, col, e.target.value)}
                                  maxLength={MAX_TABLE_CELL_LENGTH}
                                />
                              </TableCell>
                            ))}
                            <TableCell className="p-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-red-500"
                                onClick={() => removeRow(rowIndex)}
                                aria-label="Remove row"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={addRow}
                    disabled={rows.length >= MAX_TABLE_ROWS}
                  >
                    <Plus className="h-3.5 w-3.5" /> {t("fill.addRow")}
                  </Button>
                </div>
              );
            }
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
