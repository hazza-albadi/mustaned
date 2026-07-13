import type { FormField } from "@/types";
import type { Locale } from "@/lib/i18n/config";

export type ResolvedFieldEntry =
  | { id: string; kind: "value"; label: string; value: string }
  | { id: string; kind: "section_heading"; heading: string; description: string | null }
  | { id: string; kind: "image_block"; imageUrl: string; caption: string | null };

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.length > 0 ? value.join(", ") : "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function localizedLabel(field: Pick<FormField, "label" | "label_ar">, locale: Locale): string {
  return locale === "ar" && field.label_ar ? field.label_ar : field.label;
}

// Submission `data` is keyed by field id, not label, so rendering it for a
// human requires the form's field definitions. Older/legacy submissions may
// not have the definitions available (e.g. the parent form was deleted), so
// fall back to the raw keys in that case. Display-only fields (section
// headings, image blocks) never appear in `data` — their content comes
// straight from the field definition instead.
export function resolveSubmissionFields(
  fields: FormField[] | undefined,
  data: Record<string, unknown>,
  locale: Locale
): ResolvedFieldEntry[] {
  if (fields && fields.length > 0) {
    return [...fields]
      .sort((a, b) => a.order - b.order)
      .map((field): ResolvedFieldEntry => {
        if (field.type === "section_heading") {
          return {
            id: field.id,
            kind: "section_heading",
            heading: localizedLabel(field, locale),
            description: field.description || null,
          };
        }
        if (field.type === "image_block") {
          return {
            id: field.id,
            kind: "image_block",
            imageUrl: typeof field.defaultValue === "string" ? field.defaultValue : "",
            caption: field.description || null,
          };
        }
        return {
          id: field.id,
          kind: "value",
          label: localizedLabel(field, locale),
          value: formatValue(data[field.id]),
        };
      });
  }

  return Object.entries(data).map(([key, value]) => ({
    id: key,
    kind: "value",
    label: key,
    value: formatValue(value),
  }));
}
