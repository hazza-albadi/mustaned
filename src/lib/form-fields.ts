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
    options: needsOptions ? ["Option 1", "Option 2"] : [],
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
