# Internal Forms & Approval System

An internal forms and approval workflow built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS v4**, **shadcn/ui**, and **Supabase** (Postgres + Auth + Storage), built for UTAS.

Employees fill out dynamic forms; each submission routes to one or more approvers resolved from a position-based org chart (or, for a handful of forms saved before that existed, a flat literal approver list); the Super Admin (and permissioned Admins) build the forms with a drag-and-drop builder and manage the org chart, category filters, and analytics. There is no department-based access control anymore — see §5/§6.

---

## 1. Tech Stack

- Next.js 14 App Router, TypeScript, Server Components
- Tailwind CSS v4 + shadcn/ui (Radix primitives), RTL-aware (logical `ps-`/`pe-`/`ms-`/`me-` utilities)
- Supabase: Postgres, Row Level Security, Auth, Storage
- react-hook-form + zod (schemas built at runtime from each form's JSONB field definitions)
- @dnd-kit (drag-and-drop form builder)
- reactflow + dagre (org chart — auto-layout, pan/zoom, click-to-focus)
- @react-pdf/renderer (branded PDF export), rendered **server-side** in `/api/generate-pdf` — the browser only downloads the finished file, it never runs the PDF renderer itself (see §9)
- xlsx / SheetJS (multi-sheet Excel export on the analytics page)
- recharts (analytics charts), papaparse (CSV export on the admin queue), react-dropzone (file uploads)
- @upstash/ratelimit + @upstash/redis (optional distributed rate limiting — see §3/§11)

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

# Optional — distributed rate limiting. Without these, rate limiting falls
# back to a single-instance in-memory limiter (correct for local dev, but
# only effective per-instance on a horizontally-scaled deployment). Create a
# free Redis database at https://console.upstash.com to get these.
UPSTASH_REDIS_REST_URL=https://your-instance.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-upstash-rest-token
```

Find the first three values in your Supabase dashboard under **Project Settings → API**.

## 4. Supabase Configuration

### 4.1 Run the migrations

In the Supabase SQL Editor, run every file in [`supabase/migrations/`](supabase/migrations/) **in order** — there's no `supabase db push` set up for this project, so apply them by pasting each one in sequence:

| # | File | What it does |
|---|---|---|
| 0001 | `init.sql` | Core tables — `profiles`, `forms`, `form_submissions`, and an initial `departments` table (fully removed later, see 0010) — all base RLS policies, the `form-files` storage bucket, and the `handle_new_auth_user` trigger that auto-creates a `profiles` row from `auth.users` metadata |
| 0002 | `multi_approver.sql` | Adds `forms.required_approvers` and `form_submissions.approvals` (per-approver decision records) for multi-step approval chains |
| 0003 | `dynamic_dept_head.sql` | Widens `required_approvers` to `text[]` to support a (since-retired) dynamic "employee's department head" sentinel |
| 0004 | `org_tree.sql` | Adds `org_nodes` (the position-based org chart) and `forms.approval_chain` (node-based routing) |
| 0005 | `department_optional.sql` | Makes `form_submissions.department_id` optional, since routing can now resolve entirely through `approval_chain`/`org_nodes` |
| 0006 | `approval_chain_profile_visibility.sql` | Lets any approval-chain participant (submitter or listed approver) view each other's profile, independent of department |
| 0007 | `admin_permissions.sql` | Adds the `ADMIN` role and the `admin_permissions` table for granular, per-page admin access |
| 0008 | `storage_scoping.sql` | Adds `form_submissions.draft_id` and scopes the `form-files` storage read policy to actual submission participants instead of every department head bucket-wide |
| 0009 | `remove_avc_branches_node.sql` | One-off cleanup: removes an org-chart subtree (a position + its descendants) that doesn't apply to this institution's actual structure |
| 0010 | `remove_departments.sql` | **Removes the departments feature entirely** — drops the `departments` table, `profiles.department_id`, `forms.allowed_departments`, `form_submissions.department_id`, and every department-scoped RLS policy. Routing and profile visibility are org-chart/`approvals`-based only from here on |
| 0011 | `add_filters.sql` | Adds the **Filters** feature — a `filters` table and `forms.filter_ids`, a category/tag system for browsing forms (see §7.1). Unrelated to the removed departments feature — this is display/sort categorization only, with no access-control meaning |
| 0012 | `remove_submission_filter_id.sql` | Drops `form_submissions.filter_id` — a filter tags the *form*, not the individual submission |
| 0013 | `signup_requests.sql` | Adds self-service Sign Up (see §8): `profiles.civil_id`, `profiles.account_status` (PENDING/ACTIVE/REJECTED), the `approve_signups` permission, and RLS gates so an unapproved account can't self-promote or use the app beyond seeing its own status |
| 0014 | `fix_profile_locked_fields_types.sql` | Fixes a type mismatch in the RLS function 0013 added for locking down self-profile-updates (see §8) |

### 4.2 Seed demo data

```bash
npm run seed       # a Super Admin account, 6 demo Employees, demo forms
npm run seed:org    # the full UTAS org chart (positions), all seeded vacant
```

`npm run seed` populates:
- **1 Super Admin account** — check the email in `scripts/seed.ts` before running; it ships as a placeholder and needs a real address
- **6 Employees**: `emp1..emp6@company.com`, password from `SEED_USER_PASSWORD`
- **Sample dynamic forms** — a starting point; the Super Admin can edit, archive, or delete any of them, and create new ones, from `/admin/builder`

Department Head accounts are **not** seeded by this script — there's no department concept anymore. To test the approval queue, assign one of the seeded Employees to a position on the org chart at `/admin/org` (a position with at least one active sub-position promotes its holder to Department Head automatically — see §6).

`npm run seed:org` populates the real UTAS structure as position nodes, each with a fixed id so re-running the script upserts rather than duplicates. Every node starts vacant — assign real people to positions from `/admin/org`.

Both scripts are idempotent — re-running either skips rows that already exist.

### 4.3 Storage

The migrations create a private `form-files` bucket. Uploaded attachments are stored at `submissions/{draftId}/{userId}/{timestamp}-{filename}` and served via signed URLs (1-year expiry) so the bucket can stay private while still being directly linkable from the UI. The bucket itself enforces a 5MB file size limit and an allow-list of MIME types (PDF, Word, Excel, JPEG/PNG/GIF) server-side, matching the client-side limits in `src/lib/form-fields.ts`. Read access is scoped by RLS to the file's owner, the submission's actual participants (submitter + listed approvers), and Super Admins — not by department (that scoping was removed along with the departments feature, see 0010). Uploading additionally requires the caller's `profiles.account_status` be `ACTIVE` (see §8) — a pending or rejected self-service sign-up cannot upload files even with a valid session.

---

## 5. How Roles Work

| Role | Can do |
|---|---|
| **EMPLOYEE** | `/forms` — browse active forms and fill them out; `/my-submissions` — track their own submissions with status badges |
| **DEPARTMENT_HEAD** | Everything EMPLOYEE can do (`/forms` to submit their own requests, `/dashboard` to track them), plus `/admin` — the approval queue: sees every submission where they're a listed approver in the resolved `approvals` array. That's the only mechanism — there's no department-based fallback anymore. Enforced by RLS, not just UI filtering. Approve/reject with optional/required comment, CSV export, date filters. |
| **ADMIN** | Zero access by default. A Super Admin grants one or more permissions, each unlocking one page: `view_submissions` (`/admin`), `manage_forms` (`/admin/builder`), `manage_org_chart` (`/admin/org`), `manage_filters` (`/admin/filters`), `view_analytics` (`/admin/analytics`), `approve_signups` (`/admin/signups` — see §8). Managing ADMIN accounts/permissions itself is never grantable — it's hardcoded Super-Admin-only to prevent privilege escalation. |
| **SUPER_ADMIN** | Everything above, unrestricted, plus `/admin/admins` (create/manage Admin accounts and their permissions) |

A profile also has an `account_status` (`ACTIVE` unless it came from self-service Sign Up — see §8) independent of role; a non-`ACTIVE` account is blocked from every gated route and from the RLS-enforced actions above regardless of its role.

Role scoping is enforced at the database layer via RLS — the Next.js pages query Supabase directly with the user's session, and Postgres decides what rows come back. The UI never has to "remember" to filter by approver; a Department Head's Supabase session simply cannot see rows they're not part of.

## 6. Approval Routing

A submission's approvers are resolved one of two ways:

- **Position-based (current, preferred):** a form's `approval_chain` is an ordered list of org-chart steps — either a specific position (`org_nodes.id`) or "the submitter's direct manager" (their org node's parent). At submission time, [`resolveApprovalChain`](src/lib/approval-chain.ts) resolves each step to whoever currently holds that position. If any step's position is vacant, submission is blocked with a clear message rather than silently routing nowhere. Nothing about who approves is persisted on the form itself — it's always re-resolved against the live org chart. A position with at least one active child position is treated as a Department Head role; a childless position is a plain Employee role — this is decided when someone is assigned to (or approved into, see §8) a position, via [`resolveAssignedProfileId`](src/lib/assign-person.ts).
- **Legacy flat list:** forms saved before `approval_chain` existed fall back to `required_approvers`, a literal list of approver profile ids ([`resolveLegacyRequiredApprovers`](src/lib/approval-chain.ts)). New forms should use the org-chart builder step instead.

Either way, the resolved approver ids are written once to `form_submissions.approvals` as an ordered array of `{ approver_id, status, comment, decided_at }` — this array is also what RLS uses to decide who can see the submission and its files, and what analytics/PDF export use to show each approver's name, position, and decision time.

Submission creation and approval decisions are handled by server-side routes (`/api/submissions`, `/api/submissions/[id]/decision`) that re-validate the form's field schema and re-resolve the approval chain, rather than trusting whatever the client sends — the RLS insert/update policies are still the real second gate underneath those routes, not just the routes' own say-so.

## 7. Building Forms (Super Admin / `manage_forms` Admin)

1. Go to `/admin/builder` → **New Form**.
2. Drag a field type from the left palette onto the canvas (or drop it on top of an existing field to insert at that position) — including **Table**, where you define column headers and the person filling the form adds as many rows as they need at fill time (capped at 50 rows, 10 columns, 2000 characters per cell — enforced both client-side and by the submission's own re-validated schema). Tables render as real tables in both the on-screen submission view and the exported PDF.
3. Click a field to edit its label (English/Arabic), placeholder, required flag, options (for dropdown/checkbox/radio), and min/max validation.
4. Drag the grip handle on a field card to reorder it.
5. Fill in the form's title/description (English + Arabic), tag it with one or more **Filters** (see §7.1) so it's easy to find on the "Available Forms" page, and build its approval chain by picking one or more org-chart positions (or "submitter's direct manager") in order; toggle whether approval/rejection comments are required.
6. Use the **Preview** tab to see exactly what the employee will fill out.
7. **Save Form** publishes it immediately (`is_active = true`); **Archive** hides it from employees without deleting submission history.

Every field is persisted as JSONB on `forms.fields` following the exact schema in [`src/types/index.ts`](src/types/index.ts) (`id`, `type`, `label`, `label_ar`, `required`, `placeholder`, `placeholder_ar`, `options`, `defaultValue`, `validation`, `order`, plus `description` for section headings/image captions). When an employee opens `/fill/[formId]`, [`DynamicFormRenderer`](src/components/forms/dynamic-form-renderer.tsx) builds a Zod schema from that JSONB at runtime ([`buildDynamicSchema`](src/lib/validations.ts)) and renders the matching input for each field type — nothing about the form is hardcoded.

### 7.1 Filters (browsing categories)

Not to be confused with the removed departments feature — Filters have no access-control meaning at all. A Super Admin (or an Admin with `manage_filters`) manages a flat list of category values at `/admin/filters` (e.g. by branch or location). Each form can be tagged with any number of them (`forms.filter_ids`); on the "Available Forms" page, an employee can narrow the list by picking a category. Nothing about who can see or fill a form depends on filters — every active form is visible to everyone who could already see it; filters only affect display/sort order.

## 8. Self-Service Sign Up (currently disabled in the UI)

A person can request an account themselves — Civil ID, email, and a password they choose — instead of an admin provisioning it up front. The auth user + password are created immediately (real, usable credentials), but the profile starts `account_status = 'PENDING'` and `is_active = false`, invisible to the app until an admin with the new `approve_signups` permission reviews it at `/admin/signups`:

- **Approve** — optionally assign the person straight to a vacant org-chart position in the same action (role derived the same way as any new hire — Department Head if the position has active sub-positions, else Employee). Flips the profile to `ACTIVE`.
- **Reject** — flips the profile to `REJECTED`. The auth user is not banned, so sign-in still succeeds; the login form reads `account_status` right after and shows a specific "not approved" message before signing the session back out, rather than a generic auth error.

A pending or rejected account's session can authenticate against Supabase but is blocked everywhere else — gated app routes redirect via middleware, and RLS independently enforces the same thing at the data layer (a locked-down `"Users can update their own profile"` policy that only lets a self-registered account read its own status, not change it; an `auth_is_approved()` gate on submitting forms and uploading files) — this holds even against a direct Supabase SDK call that bypasses the app's UI entirely, not just page-level redirects.

**This is currently feature-flagged off**: `SIGNUP_ENABLED = false` at the top of [`src/components/auth/login-form.tsx`](src/components/auth/login-form.tsx) hides the Sign Up tab, leaving only Login. Flipping that one constant to `true` is the entire re-enable — every route, migration, and the `/admin/signups` review page are already live and untouched; check the current value in that file rather than assuming, since this is meant to change once a final rollout decision is made.

There's no Kawader integration yet to auto-verify a Civil ID or auto-place someone on the org chart from it — that's a manual admin step for now, marked with a `TODO(kawader-integration)` at the relevant point in the approve route for when that lands.

## 9. PDF Export

Approved submissions can be exported as a branded PDF from the admin queue, analytics page, or an employee's own submission history. Generation happens **server-side** — `POST /api/generate-pdf` (auth required, rate-limited) fetches the submission via the caller's own RLS-scoped session, renders it with `@react-pdf/renderer` in Node ([`renderSubmissionPdf`](src/lib/pdf/submission-pdf.tsx)), and streams the finished file back; [`DownloadPdfButton`](src/components/common/download-pdf-button.tsx) just requests it and triggers a browser download. The browser never runs the PDF renderer itself, so there's no client-side WASM/CSP concern for this feature.

## 10. Testing the App

```bash
npm run build   # type-check + lint + production build
```

Manual smoke test once seeded (`npm run seed` and `npm run seed:org`):
1. Log in as your Super Admin account → land on `/admin`. Create/edit a form at `/admin/builder`.
2. At `/admin/org`, assign one of the seeded `emp1..emp6@company.com` accounts to an org-chart position that has at least one active sub-position — this promotes them to Department Head.
3. Log in as a different seeded employee → `/forms` → pick a form whose approval chain routes to that position (or to "submitter's direct manager", if their own manager chain resolves to it) → fill it out → submit. Check `/my-submissions` — status shows **Pending** (yellow).
4. Log in as the Department Head from step 2 → `/admin` → approve or reject (rejecting requires a comment).
5. Log back in as the submitting employee → `/my-submissions` — the badge updates to **Approved** (green) / **Rejected** (red), and the rejection comment is visible in the submission detail dialog.

## 11. Deployment (Vercel)

1. Push this repo to GitHub.
2. Import it in Vercel, framework preset **Next.js**.
3. Add the Supabase environment variables (§3) in Vercel's project settings (Production + Preview) — plus the Upstash ones if you want distributed rate limiting on a multi-instance deployment.
4. Deploy. Security headers (see §13) are set in `next.config.mjs`, so they apply automatically — nothing extra to configure in `vercel.json`.
5. Run the SQL migrations (§4.1) and seed scripts against your production Supabase project before (or right after) the first deploy.

## 12. Project Structure

```
src/
  app/                        # routes (App Router)
    login/                      # Login, and Sign Up if SIGNUP_ENABLED (§8)
    forms/                      # Employee + Department Head — browse/submit
    fill/[formId]/              # Employee + Department Head — dynamic field renderer
    my-submissions/             # Employee — own submission history
    dashboard/                  # Department Head — own submission history
    admin/                     # Department Head + Admin + Super Admin
      builder/[formId]/        # manage_forms — form builder
      org/                     # manage_org_chart — position-based org chart
      filters/                 # manage_filters — browsing-category values (§7.1)
      analytics/               # view_analytics — stats, filters, Excel export
      signups/                 # approve_signups — self-service sign-up review (§8)
      admins/                  # Super Admin only — Admin accounts + permissions
      no-access/               # landing page for an Admin with zero granted permissions
    api/
      users/                   # privileged user-provisioning routes (service-role key)
      org-nodes/                # org chart CRUD (service-role key)
      admin-accounts/           # Admin account + permission management (service-role key)
      signups/                  # public sign-up creation, plus approve/reject (service-role key, §8)
      submissions/               # submission creation + approve/reject decisions (session-scoped client)
      generate-pdf/              # server-side PDF rendering (§9)
  components/
    builder/                   # drag-and-drop form builder, approval-chain builder
    forms/                     # dynamic field renderer, file upload
    org/                       # React Flow org chart canvas, node/edge renderers, edit drawer
    analytics/                 # analytics page — filters, charts, Excel export
    admin-accounts/            # Admin account create/edit UI
    filters/                   # Filters CRUD UI (§7.1)
    signups/                   # Sign-up review/approve/reject UI (§8)
    admin/, dashboard/, nav/, common/, auth/, ui/
  lib/
    supabase/                  # browser / server / middleware / admin clients
    pdf/                       # branded PDF export template, rendered server-side (§9)
    validations.ts             # zod schemas, incl. runtime schema builder for dynamic forms
    form-fields.ts              # field-type metadata + factory, upload limits, Table row/column/cell caps
    submission-fields.ts         # resolves a submission's raw data into display-ready entries (incl. Table rows)
    approval-chain.ts           # resolves a form's org-chart approval_chain at submission time
    approval-steps.ts           # flattens a submission's approvals into per-step rows (analytics export)
    approver-summary.ts         # approved-approver name/date summaries (PDF export, submission chips)
    assign-person.ts            # shared "assign an existing or brand-new person to a position" resolution
    org-layout.ts               # dagre auto-layout for the org chart
    org-position.ts             # resolves a profile's org-node position/title for display
    roles.ts                    # role/permission → landing-page routing
    admin-permission-options.ts # shared list of grantable Admin permissions
    xlsx-export.ts              # multi-sheet Excel export helper
    csv.ts                      # CSV export helper (admin submissions queue)
    auth.ts, rate-limit.ts, create-auth-user.ts, create-admin-account.ts, create-signup-user.ts, test-credentials.ts
    i18n/                       # locale context + provider
  locales/en.json, ar.json
supabase/migrations/0001-0014 (see §4.1)
scripts/seed.ts, seed-org.ts
```

## 13. Security Notes

- RLS is the source of truth for access control; pages never trust client-supplied role values, and several server-side API routes (submission creation/decisions, sign-up approval) explicitly rely on the underlying RLS policy as a second, independent gate rather than only their own checks.
- The Supabase **service role key** is only ever used server-side (`src/lib/supabase/server.ts#createAdminClient`) — never sent to the browser. Call sites: `/api/users/*`, `/api/org-nodes/*`, `/api/admin-accounts/*`, and `/api/signups/*` (create, plus approve/reject). Every one of those routes re-checks the caller's role/permissions server-side before using the admin client, independent of any UI gating.
- File uploads are validated both client-side (type allowlist, 5MB/5-file limits in `src/lib/form-fields.ts`) and server-side (the `form-files` bucket itself enforces the same size/MIME limits, plus the `account_status = ACTIVE` check described in §4.3/§8). The bucket is private; RLS scopes reads to the file's owner, the submission's actual participants (submitter + listed approvers), and Super Admins.
- `next.config.mjs` sets baseline security headers on every response: Content-Security-Policy (script-src/style-src keep `'unsafe-inline'` for the App Router's inline hydration script and a few UI libraries that set inline styles — everything else, including `frame-ancestors`/`object-src`/`connect-src`, is locked down), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS.
- `src/lib/supabase/middleware.ts` also blocks cross-site mutation attempts against `/api/*` (checks `Sec-Fetch-Site`/`Origin` on state-changing requests) as defense-in-depth alongside Supabase's `SameSite=Lax` session cookie.
- Rate limiting (`src/lib/rate-limit.ts`) covers every privileged/public-write route — user/admin/sign-up provisioning, submission creation/decisions, PDF generation. Without `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` configured (§3) it falls back to a single-instance in-memory limiter, correct for local dev but only effective per-instance on a horizontally-scaled deployment.
- Passwords this app issues (Admin accounts, self-service Sign Up) must meet a complexity policy — 10+ characters, upper/lowercase, a digit, and a symbol (`passwordComplexity` in `src/lib/validations.ts`) — not just a minimum length.
- SUPER_ADMIN and ADMIN accounts can opt into TOTP two-factor authentication from the profile chip (`src/components/auth/mfa-enroll-panel.tsx`); once enrolled, the login flow requires the second factor before completing sign-in.
- An ADMIN can never escalate itself or manage other admins. Managing ADMIN accounts/permissions isn't even a valid `admin_permissions.permission` value (excluded from the table's check constraint), and the `admin_permissions` RLS policies only let a user `select` their own row — never insert/update/delete it, even for themselves. `/api/admin-accounts/*` use the caller's own session client rather than the service-role client, so that RLS is the real enforcement, on top of an explicit `role === "SUPER_ADMIN"` check in the route handlers.
- Self-service Sign Up (§8) closed two gaps that only mattered once an unapproved account could hold a real session: a profile could previously self-update any of its own columns (no `WITH CHECK` on the self-update policy) — now locked to `role`/`account_status`/`is_active`/`civil_id`/`email` matching their current stored value, everything else (name, avatar) still freely self-editable; and submitting a form or uploading a file only checked ownership, never account status.

## 14. Arabic / RTL

- `src/locales/en.json` and `ar.json` hold every UI string.
- `I18nProvider` (`src/lib/i18n/config.tsx`) tracks the active locale in a cookie and flips `<html dir>` between `ltr`/`rtl`.
- shadcn components in this project use logical Tailwind utilities (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`) so the whole layout mirrors automatically — no separate RTL stylesheet needed.
- Toggle language from the navbar (globe/Languages icon) on any page, including `/login`.
