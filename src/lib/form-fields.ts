import { v4 as uuidv4 } from "uuid";
import type { FieldType, FormField } from "@/types";

export interface FieldTypeMeta {
  type: FieldType;
  icon: string;
  hasOptions: boolean;
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: "text", icon: "Type", hasOptions: false },
  { type: "textarea", icon: "AlignLeft", hasOptions: false },
  { type: "number", icon: "Hash", hasOptions: false },
  { type: "email", icon: "Mail", hasOptions: false },
  { type: "date", icon: "Calendar", hasOptions: false },
  { type: "dropdown", icon: "ChevronDown", hasOptions: true },
  { type: "checkbox", icon: "CheckSquare", hasOptions: true },
  { type: "radio", icon: "Circle", hasOptions: true },
  { type: "file", icon: "Paperclip", hasOptions: false },
  // hasOptions is false here even though a table has a config list too —
  // the properties panel gives table its own dedicated "Columns" editor
  // (with reordering) rather than reusing the plain Options editor.
  { type: "table", icon: "Table", hasOptions: false },
  { type: "section_heading", icon: "Heading", hasOptions: false },
  { type: "image_block", icon: "Image", hasOptions: false },
];

// Types that render display-only content (no input, nothing submitted).
// Centralized here so validations.ts, the field renderer, the properties
// panel, and the dynamic form renderer all agree on the same list.
export const NON_INPUT_FIELD_TYPES: FieldType[] = ["section_heading", "image_block"];

export function isDisplayField(type: FieldType): boolean {
  return NON_INPUT_FIELD_TYPES.includes(type);
}

// Array-shaped submission values (checkbox multi-select, table rows) — used
// wherever a default/empty value needs to be seeded before the user's first
// interaction, since these types can never default to "".
export function isArrayValueField(type: FieldType): boolean {
  return type === "checkbox" || type === "table";
}

// Row cap for a table field, enforced both client-side (disables "Add row")
// and server-side (Zod, buildDynamicSchema) — keeps the UI and the
// generated PDF from being handed an unbounded number of rows.
export const MAX_TABLE_ROWS = 50;

// Column cap for a table field, enforced both client-side (disables "Add
// column") and server-side (formFieldSchema). Determined empirically against
// the PDF's actual page width: at 10 columns (with realistic headers and
// hyphenated cell content, the worst case for @react-pdf/renderer's text
// wrapping) every header and cell stays legible with no overlap; by 12 the
// header row is already visibly crowded, and by 15 header text overlaps
// outright — so 10 is the largest count confirmed to render cleanly, not an
// arbitrary round number.
export const MAX_TABLE_COLUMNS = 10;

export function createField(type: FieldType, order: number): FormField {
  const needsOptions = FIELD_TYPES.find((f) => f.type === type)?.hasOptions ?? false;
  const label =
    type === "section_heading" ? "Untitled heading" : type === "image_block" ? "Image block" : "Untitled question";
  return {
    id: uuidv4(),
    type,
    label,
    label_ar: "",
    required: false,
    placeholder: "",
    placeholder_ar: "",
    options: type === "table" ? ["Column 1", "Column 2"] : needsOptions ? ["Option 1", "Option 2"] : [],
    defaultValue: null,
    description: "",
    validation: { min: null, max: null, pattern: null, message: null, message_ar: null },
    order,
  };
}

export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const MAX_FILES = 5;
export const ALLOWED_FILE_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
];
export const ALLOWED_FILE_MIME_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "application/vnd.ms-excel": [".xls"],
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/gif": [".gif"],
};
