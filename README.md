# Internal Forms & Approval System

An internal forms and approval workflow built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, and **Supabase** (Postgres + Auth + Storage), built for UTAS.

Employees fill out dynamic forms; each submission routes to one or more approvers resolved from a position-based org chart (or, for legacy forms, a fixed department head); the Super Admin (and permissioned Admins) build the forms with a drag-and-drop builder and manage the org chart, departments, and analytics.

---

## 1. Tech Stack

- Next.js 14 App Router, TypeScript, Server Components
- Tailwind CSS v4 + shadcn/ui (Radix primitives), RTL-aware (logical `ps-`/`pe-`/`ms-`/`me-` utilities)
- Supabase: Postgres, Row Level Security, Auth, Storage
- react-hook-form + zod (schemas built at runtime from each form's JSONB field definitions)
- @dnd-kit (drag-and-drop form builder)
- reactflow + dagre (org chart — auto-layout, pan/zoom, click-to-focus)
- @react-pdf/renderer (branded PDF export of a submission)
- xlsx / SheetJS (multi-sheet Excel export on the analytics page)
- recharts (analytics charts), papaparse (CSV export on the admin queue), react-dropzone (file uploads)

---

## 2. Project Setup

```bash
cd forms-approval-system
npm install
cp .env.example .env.local   # fill in your Supabase credentials, see below
npm run dev
```

The app is available at `http://localhost:3000`. Unauthenticated visitors are redirected to `/login`.

## 3. Environment Variables

Create `.env.local` (never commit this file) from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # server-only, never exposed to the browser
SEED_USER_PASSWORD=Password123!                   # password assigned to all seeded demo users
```

Find the first three values in your Supabase dashboard under **Project Settings → API**.

## 4. Supabase Configuration

### 4.1 Run the migrations

In the Supabase SQL Editor, run every file in [`supabase/migrations/`](supabase/migrations/) **in order** — there's no `supabase db push` set up for this project, so apply them by pasting each one in sequence:

| # | File | What it does |
|---|---|---|
| 0001 | `init.sql` | Core tables (`departments`, `profiles`, `forms`, `form_submissions`), all base RLS policies, the `form-files` storage bucket, and the `handle_new_auth_user` trigger that auto-creates a `profiles` row from `auth.users` metadata |
| 0002 | `multi_approver.sql` | Adds `forms.required_approvers` and `form_submissions.approvals` (per-approver decision records) for multi-step approval chains |
| 0003 | `dynamic_dept_head.sql` | Widens `required_approvers` to `text[]` to support the dynamic "employee's department head" sentinel |
| 0004 | `org_tree.sql` | Adds `org_nodes` (the position-based org chart) and `forms.approval_chain` (node-based routing) |
| 0005 | `department_optional.sql` | Makes `form_submissions.department_id` optional, since routing can now resolve entirely through `approval_chain`/`org_nodes` |
| 0006 | `approval_chain_profile_visibility.sql` | Lets any approval-chain participant (submitter or listed approver) view each other's profile, independent of department |
| 0007 | `admin_permissions.sql` | Adds the `ADMIN` role and the `admin_permissions` table for granular, per-page admin access |
| 0008 | `storage_scoping.sql` | Adds `form_submissions.draft_id` and scopes the `form-files` storage read policy to actual submission participants instead of every department head bucket-wide |

### 4.2 Seed demo data

```bash
npm run seed       # departments, demo users, demo forms (legacy department-routed flow)
npm run seed:org    # the full UTAS org chart (205 positions), all seeded vacant
```

`npm run seed` populates:
- **5 departments** (Engineering, IT, HR, Finance, Business — English + Arabic names)
- **12 users**: `admin@company.com` (Super Admin), `head_eng/it/hr/fin/bus@company.com` (Department Heads), `emp1..emp6@company.com` (Employees) — all with the password from `SEED_USER_PASSWORD`
- **12 sample forms** (Annual Leave, Sick Leave, Training, Performance Review, Salary Advance, Loan, Transfer, Resignation, Unpaid Leave, Housing Allowance, Car Request, Insurance) — a starting point; the Super Admin can edit, archive, or delete any of them, and create new ones, from `/admin/builder`.

`npm run seed:org` populates the real UTAS structure (University Council → Vice Chancellor → Deputy VCs → Departments → Sections) as 205 position nodes, each with a fixed id so re-running the script upserts rather than duplicates. Every node starts vacant — assign real people to positions from `/admin/org`.

Both scripts are idempotent — re-running either skips rows that already exist.

### 4.3 Storage

The migrations create a private `form-files` bucket. Uploaded attachments are stored at `submissions/{draftId}/{userId}/{timestamp}-{filename}` and served via signed URLs (1-year expiry) so the bucket can stay private while still being directly linkable from the UI. The bucket itself enforces a 5MB file size limit and an allow-list of MIME types (PDF, Word, Excel, JPEG/PNG/GIF) server-side, matching the client-side limits in `src/lib/form-fields.ts`. Read access is scoped by RLS to the file's owner, the submission's participants (submitter + listed approvers), the department head the submission was routed to, and Super Admins — not every department head bucket-wide.

---

## 5. How Roles Work

| Role | Can do |
|---|---|
| **EMPLOYEE** | `/forms` — browse active forms and fill them out; `/my-submissions` — track their own submissions with status badges |
| **DEPARTMENT_HEAD** | Everything EMPLOYEE can do (`/forms` to submit their own requests, `/dashboard` to track them), plus `/admin` — the approval queue: sees submissions where they're a listed approver in the resolved `approvals` array (the primary, org-chart-driven mechanism — see §6), or, for older submissions predating `approval_chain`, ones directly routed to their `department_id` (legacy fallback). Enforced by RLS either way, not just UI filtering. Approve/reject with optional/required comment, CSV export, date filters. |
| **ADMIN** | Zero access by default. A Super Admin grants one or more of five permissions, each unlocking one page: `view_submissions` (`/admin`), `manage_forms` (`/admin/builder`), `manage_org_chart` (`/admin/org`), `manage_departments` (`/admin/departments`), `view_analytics` (`/admin/analytics`). Managing ADMIN accounts/permissions itself is never grantable — it's hardcoded Super-Admin-only to prevent privilege escalation. |
| **SUPER_ADMIN** | Everything above, unrestricted, plus `/admin/admins` (create/manage Admin accounts and their permissions) |

Role + department/approval-chain scoping is enforced at the database layer via RLS — the Next.js pages query Supabase directly with the user's session, and Postgres decides what rows come back. The UI never has to "remember" to filter by department or approver; a Department Head's Supabase session simply cannot see rows they're not part of.

## 6. Approval Routing

A submission's approvers are resolved one of two ways:

- **Position-based (current, preferred):** a form's `approval_chain` is an ordered list of org-chart steps — either a specific position (`org_nodes.id`) or "the submitter's direct manager" (their org node's parent). At submission time, [`resolveApprovalChain`](src/lib/approval-chain.ts) resolves each step to whoever currently holds that position. If any step's position is vacant, submission is blocked with a clear message rather than silently routing nowhere. Nothing about who approves is persisted on the form itself — it's always re-resolved against the live org chart.
- **Legacy department-based:** forms saved before `approval_chain` existed fall back to a flat `required_approvers` list (or, before that, a single department head via `form_submissions.department_id`). Both paths still work; new forms should use the org-chart builder step instead.

Either way, the resolved approver ids are written once to `form_submissions.approvals` as an ordered array of `{ approver_id, status, comment, decided_at }` — this array is also what RLS uses to decide who can see the submission and its files, and what analytics/PDF export use to show each approver's name, position, and decision time.

## 7. Building Forms (Super Admin / `manage_forms` Admin)

1. Go to `/admin/builder` → **New Form**.
2. Drag a field type from the left palette onto the canvas (or drop it on top of an existing field to insert at that position).
3. Click a field to edit its label (English/Arabic), placeholder, required flag, options (for dropdown/checkbox/radio), and min/max validation.
4. Drag the grip handle on a field card to reorder it.
5. Fill in the form's title/description (English + Arabic) and build its approval chain by picking one or more org-chart positions (or "submitter's direct manager") in order; toggle whether approval/rejection comments are required.
6. Use the **Preview** tab to see exactly what the employee will fill out.
7. **Save Form** publishes it immediately (`is_active = true`); **Archive** hides it from employees without deleting submission history.

Every field is persisted as JSONB on `forms.fields` following the exact schema in the spec (`id`, `type`, `label`, `label_ar`, `required`, `placeholder`, `placeholder_ar`, `options`, `defaultValue`, `validation`, `order`). When an employee opens `/fill/[formId]`, [`DynamicFormRenderer`](src/components/forms/dynamic-form-renderer.tsx) builds a Zod schema from that JSONB at runtime ([`buildDynamicSchema`](src/lib/validations.ts)) and renders the matching input for each field type — nothing about the form is hardcoded.

## 8. Testing the App

```bash
npm run build   # type-check + lint + production build
```

Manual smoke test once seeded (`npm run seed`):
1. Log in as `admin@company.com` → land on `/admin`. Create/edit a form at `/admin/builder`.
2. Log in as `emp1@company.com` → `/forms` → pick a form → fill it out → submit. Check `/my-submissions` — status shows **Pending** (yellow).
3. Log in as the matching department head (e.g. `head_eng@company.com` if emp1's department is Engineering) → `/admin` → approve or reject (rejecting requires a comment).
4. Log back in as `emp1@company.com` → `/my-submissions` — the badge updates to **Approved** (green) / **Rejected** (red), and the rejection comment is visible in the submission detail dialog.

To exercise position-based routing instead, also run `npm run seed:org`, assign a couple of real seeded users to positions from `/admin/org`, and build a form whose approval chain uses those positions.

## 9. Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it in Vercel, framework preset **Next.js**.
3. Add the three `NEXT_PUBLIC_SUPABASE_*` / `SUPABASE_SERVICE_ROLE_KEY` environment variables in Vercel's project settings (Production + Preview).
4. Deploy. Security headers (see §10) are set in `next.config.mjs`, so they apply automatically — nothing extra to configure in `vercel.json`.
5. Run the SQL migrations (§4.1) and seed scripts against your production Supabase project before (or right after) the first deploy.

## 10. Project Structure

```
src/
  app/                        # routes (App Router)
    login/
    forms/                      # Employee + Department Head — browse/submit
    fill/[formId]/              # Employee + Department Head — dynamic field renderer
    my-submissions/             # Employee — own submission history
    dashboard/                  # Department Head — own submission history
    admin/                     # Department Head + Admin + Super Admin
      builder/[formId]/        # manage_forms — form builder
      org/                     # manage_org_chart — position-based org chart
      departments/             # manage_departments
      analytics/               # view_analytics — stats, filters, Excel export
      admins/                  # Super Admin only — Admin accounts + permissions
      no-access/               # landing page for an Admin with zero granted permissions
    api/
      users/                   # privileged user-provisioning routes (service-role key)
      org-nodes/                # org chart CRUD (service-role key)
      admin-accounts/           # Admin account + permission management (service-role key)
  components/
    builder/                   # drag-and-drop form builder
    forms/                     # dynamic field renderer, file upload
    org/                       # React Flow org chart canvas, node/edge renderers, edit drawer
    analytics/                 # analytics page — filters, charts, Excel export
    admin-accounts/            # Admin account create/edit UI
    admin/, dashboard/, departments/, nav/, common/, auth/, ui/
  lib/
    supabase/                  # browser / server / middleware / admin clients
    pdf/                       # branded PDF export template
    validations.ts             # zod schemas, incl. runtime schema builder for dynamic forms
    form-fields.ts              # field-type metadata + factory, upload limits
    approval-chain.ts           # resolves a form's org-chart approval_chain at submission time
    approval-steps.ts           # flattens a submission's approvals into per-step rows (analytics export)
    approver-summary.ts         # approved-approver name/date summaries (PDF export, submission chips)
    org-layout.ts               # dagre auto-layout for the org chart
    org-position.ts             # resolves a profile's org-node position/title for display
    roles.ts                    # role/permission → landing-page routing
    admin-permission-options.ts # shared list of grantable Admin permissions
    xlsx-export.ts              # multi-sheet Excel export helper
    csv.ts                      # CSV export helper (admin submissions queue)
    auth.ts, rate-limit.ts, create-auth-user.ts, create-admin-account.ts, test-credentials.ts
    i18n/                       # locale context + provider
  locales/en.json, ar.json
supabase/migrations/0001-0008 (see §4.1)
scripts/seed.ts, seed-org.ts
```

## 11. Security Notes

- RLS is the source of truth for access control; pages never trust client-supplied role/department values.
- The Supabase **service role key** is only ever used server-side (`src/lib/supabase/server.ts#createAdminClient`, and the `/api/users/*`, `/api/org-nodes/*`, `/api/admin-accounts/*` routes) — it is never sent to the browser. Those routes all re-check the caller's role/permissions server-side before using the admin client, independent of any UI gating.
- File uploads are validated both client-side (type allowlist, 5MB/5-file limits in `src/lib/form-fields.ts`) and server-side (the `form-files` bucket itself enforces the same size/MIME limits). The bucket is private; RLS scopes reads to the file's owner, the submission's actual participants (submitter + listed approvers), the department head it was routed to, and Super Admins.
- `next.config.mjs` sets baseline security headers on every response: Content-Security-Policy (script-src/style-src keep `'unsafe-inline'` for the App Router's inline hydration script and a few UI libraries that set inline styles — everything else, including `frame-ancestors`/`object-src`/`connect-src`, is locked down), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS.
- A simple in-memory rate limiter (`src/lib/rate-limit.ts`) throttles the user-management API routes; it's single-instance only, so swap it for a Redis-backed limiter (e.g. Upstash) before deploying to multiple serverless instances.
- An ADMIN can never escalate itself or manage other admins. Managing ADMIN accounts/permissions isn't even a valid `admin_permissions.permission` value (excluded from the table's check constraint in `0007_admin_permissions.sql`), and the `admin_permissions` RLS policies only let a user `select` their own row — never insert/update/delete it, even for themselves. `/api/admin-accounts/*` use the caller's own session client rather than the service-role client, so that RLS is the real enforcement, on top of an explicit `role === "SUPER_ADMIN"` check in the route handlers.

## 12. Arabic / RTL

- `src/locales/en.json` and `ar.json` hold every UI string.
- `I18nProvider` (`src/lib/i18n/config.tsx`) tracks the active locale in a cookie and flips `<html dir>` between `ltr`/`rtl`.
- shadcn components in this project use logical Tailwind utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) so the whole layout mirrors automatically — no separate RTL stylesheet needed.
- Toggle language from the navbar (globe/Languages icon) on any page, including `/login`.
