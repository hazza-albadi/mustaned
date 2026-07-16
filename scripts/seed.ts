/**
 * Seeds Supabase with the fixed demo dataset described in the project spec:
 * 1 Super Admin, 6 Employees, and 12 sample dynamic forms. Department Head
 * accounts are no longer seeded here — routing/approval is org-tree based
 * (see seed-org.ts); create a Department Head via the org chart's "assign
 * person" flow on a position instead.
 *
 * Usage: npm run seed
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from "uuid";
import type { FormField } from "../src/types";
import { createAuthUser } from "../src/lib/create-auth-user";
import { SEED_USER_PASSWORD } from "../src/lib/test-credentials";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function field(partial: Partial<FormField> & Pick<FormField, "type" | "label" | "order">): FormField {
  return {
    id: uuidv4(),
    label_ar: "",
    required: true,
    placeholder: "",
    placeholder_ar: "",
    options: [],
    defaultValue: null,
    description: "",
    validation: { min: null, max: null, pattern: null, message: null, message_ar: null },
    ...partial,
  };
}

async function createUserIfMissing(opts: {
  email: string;
  name: string;
  name_ar?: string;
  role: "SUPER_ADMIN" | "DEPARTMENT_HEAD" | "EMPLOYEE";
}) {
  const { data: existingProfile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", opts.email)
    .maybeSingle();

  if (existingProfile) {
    console.log(`User already exists: ${opts.email}`);
    return existingProfile.id as string;
  }

  const { data, error } = await createAuthUser({
    email: opts.email,
    metadata: {
      name: opts.name,
      name_ar: opts.name_ar,
      role: opts.role,
    },
  });

  if (error || !data.user) {
    throw error ?? new Error(`Failed to create ${opts.email}`);
  }

  console.log(`Created user: ${opts.email} (${opts.role})`);
  return data.user.id;
}

async function seedUsers() {
  const adminId = await createUserIfMissing({
    email: "==",
    name: "Super Admin",
    name_ar: "المدير العام",
    role: "SUPER_ADMIN",
  });

  for (let i = 1; i <= 6; i++) {
    await createUserIfMissing({
      email: `emp${i}@company.com`,
      name: `Employee ${i}`,
      name_ar: `موظف ${i}`,
      role: "EMPLOYEE",
    });
  }

  return adminId;
}

async function seedForms(adminId: string) {
  const forms: { title: string; title_ar: string; description: string; fields: FormField[] }[] = [
    {
      title: "Annual Leave Request",
      title_ar: "طلب إجازة سنوية",
      description: "Request your yearly paid leave.",
      fields: [
        field({ type: "date", label: "Start Date", label_ar: "تاريخ البدء", order: 0 }),
        field({ type: "date", label: "End Date", label_ar: "تاريخ الانتهاء", order: 1 }),
        field({ type: "textarea", label: "Reason", label_ar: "السبب", required: false, order: 2 }),
      ],
    },
    {
      title: "Sick Leave Request",
      title_ar: "طلب إجازة مرضية",
      description: "Request sick leave with supporting documents.",
      fields: [
        field({ type: "date", label: "Date", label_ar: "التاريخ", order: 0 }),
        field({ type: "number", label: "Number of Days", label_ar: "عدد الأيام", order: 1, validation: { min: 1, max: 90, pattern: null, message: "Must be between 1 and 90", message_ar: "يجب أن يكون بين 1 و 90" } }),
        field({ type: "file", label: "Medical Certificate", label_ar: "الشهادة الطبية", required: false, order: 2 }),
      ],
    },
    {
      title: "Training Request",
      title_ar: "طلب تدريب",
      description: "Request to attend a training course or conference.",
      fields: [
        field({ type: "text", label: "Course Name", label_ar: "اسم الدورة", order: 0 }),
        field({ type: "text", label: "Provider", label_ar: "الجهة المقدمة", required: false, order: 1 }),
        field({ type: "date", label: "Start Date", label_ar: "تاريخ البدء", order: 2 }),
        field({ type: "number", label: "Estimated Cost", label_ar: "التكلفة المقدرة", required: false, order: 3 }),
      ],
    },
    {
      title: "Performance Review",
      title_ar: "تقييم أداء",
      description: "Self-assessment for the quarterly performance review.",
      fields: [
        field({ type: "dropdown", label: "Review Period", label_ar: "فترة التقييم", options: ["Q1", "Q2", "Q3", "Q4"], order: 0 }),
        field({ type: "textarea", label: "Key Achievements", label_ar: "أبرز الإنجازات", order: 1 }),
        field({ type: "textarea", label: "Areas for Improvement", label_ar: "مجالات التحسين", required: false, order: 2 }),
      ],
    },
    {
      title: "Salary Advance",
      title_ar: "طلب سلفة",
      description: "Request an advance against your salary.",
      fields: [
        field({ type: "number", label: "Amount", label_ar: "المبلغ", order: 0, validation: { min: 1, max: null, pattern: null, message: "Amount must be positive", message_ar: "يجب أن يكون المبلغ موجباً" } }),
        field({ type: "textarea", label: "Reason", label_ar: "السبب", order: 1 }),
      ],
    },
    {
      title: "Loan Request",
      title_ar: "طلب قرض",
      description: "Apply for an internal company loan.",
      fields: [
        field({ type: "number", label: "Loan Amount", label_ar: "مبلغ القرض", order: 0 }),
        field({ type: "number", label: "Repayment Months", label_ar: "عدد أشهر السداد", order: 1, validation: { min: 1, max: 60, pattern: null, message: null, message_ar: null } }),
        field({ type: "file", label: "Supporting Documents", label_ar: "المستندات الداعمة", required: false, order: 2 }),
      ],
    },
    {
      title: "Transfer Request",
      title_ar: "طلب تحويل",
      description: "Request a transfer to another department or location.",
      fields: [
        field({ type: "dropdown", label: "Requested Department", label_ar: "القسم المطلوب", options: ["Engineering", "IT", "HR", "Finance", "Business"], order: 0 }),
        field({ type: "textarea", label: "Reason for Transfer", label_ar: "سبب التحويل", order: 1 }),
      ],
    },
    {
      title: "Resignation Request",
      title_ar: "طلب استقالة",
      description: "Submit your formal resignation.",
      fields: [
        field({ type: "date", label: "Last Working Day", label_ar: "آخر يوم عمل", order: 0 }),
        field({ type: "textarea", label: "Reason", label_ar: "السبب", required: false, order: 1 }),
      ],
    },
    {
      title: "Unpaid Leave",
      title_ar: "إجازة بدون راتب",
      description: "Request leave without pay.",
      fields: [
        field({ type: "date", label: "Start Date", label_ar: "تاريخ البدء", order: 0 }),
        field({ type: "date", label: "End Date", label_ar: "تاريخ الانتهاء", order: 1 }),
        field({ type: "textarea", label: "Reason", label_ar: "السبب", order: 2 }),
      ],
    },
    {
      title: "Housing Allowance",
      title_ar: "بدل سكن",
      description: "Request a housing allowance.",
      fields: [
        field({ type: "text", label: "Current Address", label_ar: "العنوان الحالي", order: 0 }),
        field({ type: "file", label: "Lease Agreement", label_ar: "عقد الإيجار", required: false, order: 1 }),
      ],
    },
    {
      title: "Car Request",
      title_ar: "طلب سيارة",
      description: "Request a company car or transport allowance.",
      fields: [
        field({ type: "radio", label: "Request Type", label_ar: "نوع الطلب", options: ["Company Car", "Transport Allowance"], order: 0 }),
        field({ type: "textarea", label: "Justification", label_ar: "المبرر", order: 1 }),
      ],
    },
    {
      title: "Insurance Request",
      title_ar: "طلب تأمين",
      description: "Request changes to your insurance coverage.",
      fields: [
        field({ type: "checkbox", label: "Coverage Type", label_ar: "نوع التغطية", options: ["Medical", "Dental", "Life", "Family"], order: 0 }),
        field({ type: "email", label: "Contact Email", label_ar: "البريد الإلكتروني للتواصل", order: 1 }),
      ],
    },
  ];

  for (const form of forms) {
    const { data: existing } = await supabase.from("forms").select("id").eq("title", form.title).maybeSingle();
    if (existing) {
      console.log(`Form already exists: ${form.title}`);
      continue;
    }
    const { error } = await supabase.from("forms").insert({
      title: form.title,
      title_ar: form.title_ar,
      description: form.description,
      fields: form.fields,
      allowed_departments: null,
      requires_approval: true,
      requires_comment: true,
      is_active: true,
      created_by: adminId,
    });
    if (error) throw error;
    console.log(`Created form: ${form.title}`);
  }
}

async function main() {
  const adminId = await seedUsers();
  await seedForms(adminId);
  console.log("\nSeed complete. Default password for all seeded users:", SEED_USER_PASSWORD);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
