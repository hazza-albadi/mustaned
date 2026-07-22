import { z } from "zod";
import type { FormField } from "@/types";
import { isDisplayField, MAX_TABLE_ROWS, MAX_TABLE_COLUMNS } from "@/lib/form-fields";

/**
 * Builds a Zod schema at runtime from a form's dynamic JSONB field
 * definitions, so validation rules (required, min/max, pattern) defined by
 * the Super Admin in the Form Builder are enforced on every submission.
 */
export function buildDynamicSchema(fields: FormField[], locale: "en" | "ar" = "en") {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const field of fields) {
    // Display-only fields (section headings, image blocks) collect no input
    // and must not appear in the submitted data JSONB — skip entirely rather
    // than adding a Zod entry for them.
    if (isDisplayField(field.type)) continue;

    const msg =
      (locale === "ar" ? field.validation?.message_ar : field.validation?.message) ?? undefined;

    let schema: z.ZodTypeAny;

    switch (field.type) {
      case "number": {
        let num = z.coerce.number({
          error: msg ?? "Must be a number",
        });
        if (field.validation?.min != null) num = num.min(field.validation.min, msg);
        if (field.validation?.max != null) num = num.max(field.validation.max, msg);
        schema = num;
        break;
      }
      case "email":
        schema = z.string().email(msg ?? "Invalid email address");
        break;
      case "checkbox":
        // Plain ZodArray here, deliberately NOT wrapped in .default([]) yet —
        // .default() returns a ZodDefault wrapper that doesn't expose
        // .min()/.max(), so wrapping first breaks the required-field check
        // below. The default is applied after that check, in the
        // post-processing block.
        schema = z.array(z.string());
        break;
      case "file":
        // The file field stores just the selected filename as a string
        // (the binary itself goes through the separate attachments
        // uploader), so it validates like any other string field — this
        // also makes "required" actually enforce a non-empty selection
        // instead of silently no-op'ing on z.any().
        schema = z.string();
        break;
      case "table":
        // Each row is a plain string-keyed record rather than a schema built
        // from the field's current column names — if an admin renames/adds/
        // removes a column after submissions already exist, older rows
        // should still round-trip instead of failing validation retroactively.
        schema = z.array(z.record(z.string(), z.string())).max(MAX_TABLE_ROWS, "Too many rows");
        break;
      case "date":
      case "dropdown":
      case "radio":
      case "text":
      case "textarea":
      default: {
        let str = z.string();
        if (field.validation?.min != null) str = str.min(field.validation.min, msg);
        if (field.validation?.max != null) str = str.max(field.validation.max, msg);
        if (field.validation?.pattern) {
          str = str.regex(new RegExp(field.validation.pattern), msg ?? "Invalid format");
        }
        schema = str;
        break;
      }
    }

    if (schema instanceof z.ZodArray) {
      // Array-shaped fields (checkbox multi-select, table rows) — .min()
      // must run on the raw ZodArray before .default() wraps it, since
      // ZodDefault doesn't expose .min()/.max().
      schema = field.required ? schema.min(1, msg ?? "This field is required") : schema.default([]);
    } else if (field.required) {
      if (schema instanceof z.ZodString) {
        schema = schema.min(1, msg ?? "This field is required");
      }
    } else {
      schema = schema.optional().or(z.literal(""));
    }

    shape[field.id] = schema;
  }

  return z.object(shape);
}

export const submissionFormSchema = (fields: FormField[], locale: "en" | "ar") =>
  z.object({
    data: buildDynamicSchema(fields, locale),
  });

// S-09: length alone (the previous `min(8)`-only rule) doesn't rule out
// "password1" or "aaaaaaaa". Require at least one lowercase, one uppercase,
// one digit, and one symbol — applied to every account this app issues a
// password for, including SUPER_ADMIN (created via userSchema) and ADMIN
// (adminAccountSchema below), the two roles where a weak password matters
// most since they carry the broadest RLS bypass.
const passwordComplexity = z
  .string()
  .min(10, "Password must be at least 10 characters")
  .max(128, "Password must be at most 128 characters")
  .regex(/[a-z]/, "Password must contain a lowercase letter")
  .regex(/[A-Z]/, "Password must contain an uppercase letter")
  .regex(/[0-9]/, "Password must contain a number")
  .regex(/[^a-zA-Z0-9]/, "Password must contain a symbol");

export const userSchema = z.object({
  name: z.string().min(2, "Name is required"),
  name_ar: z.string().optional(),
  email: z.string().email("Invalid email address"),
  role: z.enum(["SUPER_ADMIN", "DEPARTMENT_HEAD", "EMPLOYEE"]),
  password: passwordComplexity.optional(),
});

export const adminPermissionEnum = z.enum([
  "manage_forms",
  "manage_org_chart",
  "view_analytics",
  "view_submissions",
  "manage_filters",
]);

export const filterSchema = z.object({
  name: z.string().min(2, "Name is required"),
  name_ar: z.string().min(2, "Arabic name is required"),
  is_active: z.boolean().default(true),
});

export const adminAccountSchema = z.object({
  name: z.string().min(2, "Name is required"),
  name_ar: z.string().optional(),
  email: z.string().email("Invalid email address"),
  // Real password, chosen directly by the Super Admin — required, no
  // auto-generation (this is not a test account).
  password: passwordComplexity,
  permissions: z.array(adminPermissionEnum),
});

export const adminPermissionsUpdateSchema = z.object({
  permissions: z.array(adminPermissionEnum),
});

export const fieldValidationSchema = z.object({
  min: z.number().nullable(),
  max: z.number().nullable(),
  pattern: z.string().nullable(),
  message: z.string().nullable(),
  message_ar: z.string().nullable(),
});

export const formFieldSchema = z
  .object({
    id: z.string(),
    type: z.enum([
      "text",
      "textarea",
      "number",
      "email",
      "date",
      "dropdown",
      "checkbox",
      "radio",
      "file",
      "table",
      "section_heading",
      "image_block",
    ]),
    label: z.string().min(1, "Label is required"),
    label_ar: z.string(),
    required: z.boolean(),
    placeholder: z.string(),
    placeholder_ar: z.string(),
    options: z.array(z.string()),
    defaultValue: z.union([z.string(), z.number(), z.boolean(), z.null()]),
    // Optional/defaulted so forms saved before this field existed still parse.
    description: z.string().default(""),
    validation: fieldValidationSchema,
    order: z.number(),
  })
  // Table's `options` holds column headers, not free-form choices — needs
  // its own shape rules (at least one, none blank, none duplicated, capped)
  // on top of the plain array(string) check above.
  .superRefine((field, ctx) => {
    if (field.type !== "table") return;
    if (field.options.length < 1) {
      ctx.addIssue({ code: "custom", message: "Add at least one column", path: ["options"] });
      return;
    }
    if (field.options.length > MAX_TABLE_COLUMNS) {
      ctx.addIssue({ code: "custom", message: "Too many columns", path: ["options"] });
      return;
    }
    const trimmed = field.options.map((c) => c.trim());
    if (trimmed.some((c) => c.length === 0)) {
      ctx.addIssue({ code: "custom", message: "Column names cannot be empty", path: ["options"] });
    }
    if (new Set(trimmed).size !== trimmed.length) {
      ctx.addIssue({ code: "custom", message: "Column names must be unique", path: ["options"] });
    }
  });

export const approvalEntrySchema = z.object({
  approver_id: z.string().uuid(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED"]),
  comment: z.string().nullable(),
  decided_at: z.string().nullable(),
});

export const approvalChainStepSchema = z.union([
  z.object({ type: z.literal("node"), node_id: z.string().uuid(), label: z.string() }),
  z.object({ type: z.literal("direct_manager"), label: z.string() }),
]);

export const orgNodeSchema = z.object({
  title: z.string().min(1, "Title is required"),
  parent_id: z.string().uuid().nullable().optional(),
  assigned_profile_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
});

export const formBuilderSchema = z.object({
  title: z.string().min(2, "Title is required"),
  title_ar: z.string().optional(),
  description: z.string().optional(),
  description_ar: z.string().optional(),
  fields: z.array(formFieldSchema).min(1, "Add at least one field"),
  filter_ids: z.array(z.string().uuid()),
  // Legacy flat approver list — kept for forms saved before approval_chain
  // existed, no longer editable from the builder UI.
  required_approvers: z.array(z.string()),
  approval_chain: z.array(approvalChainStepSchema),
  requires_approval: z.boolean(),
  requires_comment: z.boolean(),
  is_active: z.boolean(),
});

export const rejectSchema = z.object({
  comment: z.string().min(3, "A comment is required when rejecting a request"),
});
