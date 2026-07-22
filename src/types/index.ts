// ============================================================================
// Core domain types — mirror the Supabase schema exactly.
//
// NOTE: these are declared with `type`, not `interface`. Postgrest's
// generated `.insert()`/`.update()` overloads rely on the Row/Insert/Update
// shapes structurally satisfying `Record<string, unknown>` inside a
// conditional-type default; `interface` declarations don't resolve eagerly
// enough for that check and silently collapse the whole client to `never`.
// ============================================================================

export type Role = "SUPER_ADMIN" | "ADMIN" | "DEPARTMENT_HEAD" | "EMPLOYEE";

// Matches the real /admin pages exactly — one permission per page. Managing
// ADMIN accounts/permissions is deliberately not in this list; it's hardcoded
// SUPER_ADMIN-only to prevent privilege escalation.
export type AdminPermission =
  | "manage_forms"
  | "manage_org_chart"
  | "view_analytics"
  | "view_submissions"
  | "manage_filters";

export type AdminPermissionRow = {
  id: string;
  profile_id: string;
  permission: AdminPermission;
  granted_by: string | null;
  granted_at: string;
};

export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export type FieldType =
  | "text"
  | "textarea"
  | "number"
  | "email"
  | "date"
  | "dropdown"
  | "checkbox"
  | "radio"
  | "file"
  // Freeform table: admin defines only column headers (stored in `options`,
  // same slot dropdown/checkbox/radio use for their string lists); the
  // filler adds as many rows as they want, each cell plain text.
  | "table"
  // Display-only layout types: render content between questions but collect
  // no user input, are excluded from validation and submission.data.
  | "section_heading"
  | "image_block";

export type FieldValidation = {
  min: number | null;
  max: number | null;
  pattern: string | null;
  message: string | null;
  message_ar: string | null;
};

export type FormField = {
  id: string;
  type: FieldType;
  label: string;
  label_ar: string;
  required: boolean;
  placeholder: string;
  placeholder_ar: string;
  // Choice list for dropdown/checkbox/radio. Also doubles as the ordered
  // column-header list for a table field — same "list of strings" slot,
  // just a different meaning for that one type.
  options: string[];
  defaultValue: string | number | boolean | null;
  // Section heading subtext, or image_block caption. Unused by input types.
  description: string;
  validation: FieldValidation;
  order: number;
};

// Purely a display/sort categorization tag on forms (e.g. branch or
// location) — no access-control meaning, unlike the removed departments
// feature. A form can belong to several (forms.filter_ids); used to narrow
// the "Available Forms" listing, not stored on individual submissions.
export type Filter = {
  id: string;
  name: string;
  name_ar: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Profile = {
  id: string;
  name: string;
  name_ar: string | null;
  email: string;
  role: Role;
  is_active: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type FormDefinition = {
  id: string;
  title: string;
  title_ar: string | null;
  description: string | null;
  description_ar: string | null;
  fields: FormField[];
  // Category tags this form belongs to, used to narrow the "Available
  // Forms" listing. Display/sort categorization only — no access-control
  // meaning.
  filter_ids: string[];
  // Legacy flat approver list — kept for forms saved before approval_chain
  // existed. New forms leave this empty and use approval_chain instead.
  required_approvers: string[];
  approval_chain: ApprovalChainStep[];
  requires_approval: boolean;
  requires_comment: boolean;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SubmissionFile = {
  name: string;
  url: string;
  size: number;
  type: string;
};

export type ApprovalEntry = {
  approver_id: string;
  status: SubmissionStatus;
  comment: string | null;
  decided_at: string | null;
};

export type FormSubmission = {
  id: string;
  form_id: string;
  submitted_by: string;
  data: Record<string, unknown>;
  status: SubmissionStatus;
  approver_id: string | null;
  approver_comment: string | null;
  approved_at: string | null;
  files: SubmissionFile[];
  approvals: ApprovalEntry[];
  draft_id: string | null;
  created_at: string;
  updated_at: string;
};

// A permanent position/job title. Approval routing references node ids, never
// person ids — assigned_profile_id is optional, and a null value (or an
// inactive node) means the position is vacant, which blocks any submission
// whose approval_chain routes through it.
export type OrgNode = {
  id: string;
  title: string;
  parent_id: string | null;
  assigned_profile_id: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ApprovalChainStep =
  | { type: "node"; node_id: string; label: string }
  | { type: "direct_manager"; label: string };

export type FormSubmissionWithRelations = FormSubmission & {
  form?: Pick<FormDefinition, "id" | "title" | "title_ar" | "fields">;
  submitter?: Pick<Profile, "id" | "name" | "name_ar" | "email">;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Partial<Profile> & { id: string; name: string; email: string; role: Role };
        Update: Partial<Profile>;
        Relationships: [];
      };
      forms: {
        Row: FormDefinition;
        Insert: Partial<FormDefinition> & { title: string; fields: FormField[] };
        Update: Partial<FormDefinition>;
        Relationships: [];
      };
      form_submissions: {
        Row: FormSubmission;
        Insert: Partial<FormSubmission> & {
          form_id: string;
          submitted_by: string;
          data: Record<string, unknown>;
        };
        Update: Partial<FormSubmission>;
        Relationships: [];
      };
      org_nodes: {
        Row: OrgNode;
        Insert: Partial<OrgNode> & { title: string };
        Update: Partial<OrgNode>;
        Relationships: [];
      };
      admin_permissions: {
        Row: AdminPermissionRow;
        Insert: Partial<AdminPermissionRow> & { profile_id: string; permission: AdminPermission };
        Update: Partial<AdminPermissionRow>;
        Relationships: [];
      };
      filters: {
        Row: Filter;
        Insert: Partial<Filter> & { name: string; name_ar: string };
        Update: Partial<Filter>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
