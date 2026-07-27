import {
  buildDynamicSchema,
  civilIdSchema,
  formFieldSchema,
  isSafeRedirectPath,
  signupRequestSchema,
} from "@/lib/validations";
import { MAX_TABLE_CELL_LENGTH, MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from "@/lib/form-fields";
import type { FormField } from "@/types";

describe("passwordComplexity (via signupRequestSchema)", () => {
  const base = { civil_id: "12345678", email: "person@example.com" };

  it("accepts a password meeting every requirement", () => {
    const result = signupRequestSchema.safeParse({ ...base, password: "Abcdefgh1!" });
    expect(result.success).toBe(true);
  });

  it("rejects a password under 10 characters", () => {
    const result = signupRequestSchema.safeParse({ ...base, password: "Ab1!defg" });
    expect(result.success).toBe(false);
  });

  it("rejects a password over 128 characters", () => {
    const result = signupRequestSchema.safeParse({ ...base, password: `Ab1!${"a".repeat(128)}` });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no uppercase letter", () => {
    const result = signupRequestSchema.safeParse({ ...base, password: "abcdefgh1!" });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no lowercase letter", () => {
    const result = signupRequestSchema.safeParse({ ...base, password: "ABCDEFGH1!" });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no digit", () => {
    const result = signupRequestSchema.safeParse({ ...base, password: "Abcdefgh!!" });
    expect(result.success).toBe(false);
  });

  it("rejects a password with no symbol", () => {
    const result = signupRequestSchema.safeParse({ ...base, password: "Abcdefgh12" });
    expect(result.success).toBe(false);
  });

  it("rejects length-only-plausible passwords like 'password1' (no uppercase/symbol)", () => {
    // The specific real-world weak passwords S-09 was written to reject.
    expect(signupRequestSchema.safeParse({ ...base, password: "password1" }).success).toBe(false);
    expect(signupRequestSchema.safeParse({ ...base, password: "aaaaaaaa" }).success).toBe(false);
  });
});

describe("civilIdSchema", () => {
  it("accepts an 8-digit numeric string", () => {
    expect(civilIdSchema.safeParse("12345678").success).toBe(true);
  });

  it.each(["1234567", "123456789", "1234567a", "", "1234-567"])(
    "rejects an invalid Civil ID: %p",
    (value) => {
      expect(civilIdSchema.safeParse(value).success).toBe(false);
    }
  );
});

function baseField(overrides: Partial<FormField> & Pick<FormField, "type">): FormField {
  return {
    id: "field-1",
    label: "Label",
    label_ar: "",
    required: false,
    placeholder: "",
    placeholder_ar: "",
    options: [],
    defaultValue: null,
    description: "",
    validation: { min: null, max: null, pattern: null, message: null, message_ar: null },
    order: 0,
    ...overrides,
  };
}

describe("formFieldSchema — table column caps", () => {
  it("accepts a table field with at least one, non-empty, unique column", () => {
    const field = baseField({ type: "table", options: ["Item", "Quantity"] });
    expect(formFieldSchema.safeParse(field).success).toBe(true);
  });

  it("rejects a table field with zero columns", () => {
    const field = baseField({ type: "table", options: [] });
    const result = formFieldSchema.safeParse(field);
    expect(result.success).toBe(false);
  });

  it(`rejects a table field with more than ${MAX_TABLE_COLUMNS} columns`, () => {
    const field = baseField({
      type: "table",
      options: Array.from({ length: MAX_TABLE_COLUMNS + 1 }, (_, i) => `Column ${i}`),
    });
    expect(formFieldSchema.safeParse(field).success).toBe(false);
  });

  it(`accepts a table field with exactly ${MAX_TABLE_COLUMNS} columns`, () => {
    const field = baseField({
      type: "table",
      options: Array.from({ length: MAX_TABLE_COLUMNS }, (_, i) => `Column ${i}`),
    });
    expect(formFieldSchema.safeParse(field).success).toBe(true);
  });

  it("rejects duplicate column names", () => {
    const field = baseField({ type: "table", options: ["Item", "Item"] });
    expect(formFieldSchema.safeParse(field).success).toBe(false);
  });

  it("rejects a blank column name", () => {
    const field = baseField({ type: "table", options: ["Item", "  "] });
    expect(formFieldSchema.safeParse(field).success).toBe(false);
  });
});

describe("buildDynamicSchema — table row/cell caps", () => {
  const tableField = baseField({ type: "table", options: ["Item", "Qty"], required: false });
  const schema = buildDynamicSchema([tableField]);

  it("accepts a table submission within the row/cell caps", () => {
    const result = schema.safeParse({ [tableField.id]: [{ Item: "Pens", Qty: "10" }] });
    expect(result.success).toBe(true);
  });

  it(`rejects more than ${MAX_TABLE_ROWS} rows`, () => {
    const rows = Array.from({ length: MAX_TABLE_ROWS + 1 }, () => ({ Item: "x", Qty: "1" }));
    const result = schema.safeParse({ [tableField.id]: rows });
    expect(result.success).toBe(false);
  });

  it(`accepts exactly ${MAX_TABLE_ROWS} rows`, () => {
    const rows = Array.from({ length: MAX_TABLE_ROWS }, () => ({ Item: "x", Qty: "1" }));
    const result = schema.safeParse({ [tableField.id]: rows });
    expect(result.success).toBe(true);
  });

  it(`rejects a cell longer than ${MAX_TABLE_CELL_LENGTH} characters`, () => {
    const result = schema.safeParse({
      [tableField.id]: [{ Item: "a".repeat(MAX_TABLE_CELL_LENGTH + 1), Qty: "1" }],
    });
    expect(result.success).toBe(false);
  });

  it(`accepts a cell exactly ${MAX_TABLE_CELL_LENGTH} characters long`, () => {
    const result = schema.safeParse({
      [tableField.id]: [{ Item: "a".repeat(MAX_TABLE_CELL_LENGTH), Qty: "1" }],
    });
    expect(result.success).toBe(true);
  });
});

describe("isSafeRedirectPath", () => {
  it("accepts a plain relative path", () => {
    expect(isSafeRedirectPath("/admin/org")).toBe(true);
  });

  it("rejects null (no redirect param present)", () => {
    expect(isSafeRedirectPath(null)).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isSafeRedirectPath("")).toBe(false);
  });

  it("rejects a protocol-relative external URL (//evil.com)", () => {
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
  });

  it("rejects the backslash bypass (/\\evil.com)", () => {
    expect(isSafeRedirectPath("/\\evil.com")).toBe(false);
  });

  it("rejects an absolute external URL", () => {
    expect(isSafeRedirectPath("https://evil.com")).toBe(false);
  });

  it("rejects a path with no leading slash", () => {
    expect(isSafeRedirectPath("admin/org")).toBe(false);
  });
});
