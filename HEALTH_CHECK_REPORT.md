# Codebase Health Check

Produced during an overnight unattended session (caching audit + cleanup + testing
+ Kawader scaffolding work). This is a **report**, not a fix list — nothing below
was changed except the two items explicitly marked "fixed" (already committed
separately, listed here for completeness) and the two trivial exceptions noted
in Task 2's own commit.

Scope: every page, API route, and lib module was read this session (either
tonight or in the two prior sessions building the caching audit and the
Sign-Up verified-handoff feature); most components were read; a handful of
lower-traffic admin components (analytics charts, PDF template internals)
were not opened line-by-line. Treat this as a thorough pass, not a literal
line-by-line audit of 100% of the repository.

---

## Bugs (prioritized)

### 1. [HIGH] Deleting a form permanently destroys all of its submission history, with no warning

- **Where:** `src/app/api/forms/[id]/route.ts` (`DELETE`), `supabase/migrations/0001_init.sql:55` (`form_submissions.form_id ... references forms(id) on delete cascade`), `src/components/builder/forms-list.tsx` (the confirm dialog).
- **What's wrong:** `form_submissions.form_id` has an `on delete cascade` foreign key. Deleting a form doesn't just hide it — it **cascades and permanently deletes every submission ever made against it**, including approved, historical, audit-relevant ones. The confirm dialog (`forms-list.tsx`) shows only the form's title (`{deleteTarget?.title}`) with no mention that submissions will be destroyed too.
- **How to confirm:** create a form, submit and approve one instance of it, delete the form via `/admin/builder`, then check `form_submissions` for that form's id — the row is gone.
- **Impact:** silent, irreversible data loss. An admin doing routine cleanup ("remove an old form nobody uses anymore") has no way to know they're also erasing every past submitter's record for it. This predates tonight's session (the route move preserved it exactly, per the "don't change behavior" instruction) but is worth fixing soon.
- **Suggested direction** (not implemented — a real product decision, not mine to make unilaterally): either drop the cascade in favor of `on delete restrict` (block deleting a form that has submissions, forcing an explicit "archive" instead) or add a real warning to the confirm dialog stating how many submissions will be deleted.

### 2. [MEDIUM] Editing a user's email can leave Auth and the profile out of sync on partial failure

- **Where:** `src/app/api/users/[id]/route.ts` (`PATCH`), lines 58–72.
- **What's wrong:** the route first calls `admin.auth.admin.updateUserById(id, { email })` (changes the real sign-in credential), and only *then* writes the same email to `profiles.email` in a separate call. If the second write fails for any reason (transient DB error, an unexpected constraint), the function returns a 400 — but the auth email change already committed and is never rolled back. The person would now sign in with their new email while the app displays/looks up their old one everywhere via `profiles.email`.
- **How to confirm:** simulate the second update failing (e.g., temporarily point the profile update at an id that violates a constraint) and observe that `auth.users.email` and `profiles.email` diverge with no error surfaced beyond "something went wrong."
- **Impact:** confusing, hard-to-self-diagnose account state; requires direct DB access to fix afterward. Narrow window to trigger, but the failure mode has no recovery path today.

### 3. [MEDIUM] The in-memory rate-limit fallback leaks memory for the lifetime of the process

- **Where:** `src/lib/rate-limit.ts`, the `buckets` Map (line 70) and `inMemoryRateLimit()` (lines 72–85).
- **What's wrong:** every distinct rate-limit key (e.g. `signups:status:203.0.113.7`) gets an entry that is only ever *overwritten* on a subsequent request from that same key — never deleted. A key that's seen once and never again (a one-off visitor IP, for instance) stays in the Map forever.
- **Impact:** on Vercel with short-lived function instances this is largely self-limiting (memory resets between cold starts). It's a real, slow-burning leak for any long-running Node process without Upstash configured — a `next start` self-host, or a long-lived local dev server — since this is also the exact fallback path this project's own docs say is the expected local-dev configuration.
- **Suggested direction**: periodic sweep of expired entries (e.g., check-and-evict on each `inMemoryRateLimit` call, or a low-frequency `setInterval`), or cap the Map's size with LRU eviction.

### 4. [LOW] `PATCH /api/users/[id]` has no self-target guard, unlike its sibling `DELETE`

- **Where:** `src/app/api/users/[id]/route.ts` — `DELETE` explicitly checks `if (id === caller.user.id) return "You cannot delete your own account"` (line 90); `PATCH` has no equivalent check.
- **What's wrong:** a Super Admin calling `PATCH` on their own profile id isn't blocked by the route itself — `caller.isSuperAdmin` short-circuits the only guard that exists (the Department-Head/Employee target-role check). In practice this is likely unreachable today (the org-chart "edit person" UI probably never lets an admin pick themselves), but the route itself doesn't defend against it the way `DELETE` does.
- **Suggested direction**: either confirm the UI genuinely can't reach this case and leave it, or add the same self-target guard `DELETE` already has, for consistency.

### Already found and fixed this session (listed for completeness, not new)

- `scripts/seed.ts` referenced `allowed_departments`, a column `0010_remove_departments.sql` dropped entirely — `npm run seed` would have thrown on the very first form insert against a fresh database. Fixed in the "remove stale references to the removed departments feature" commit.
- Migration `0015`'s `account_status` column stayed `varchar(20)` while adding a 27-character status value — every approval failed with "value too long." Found via full E2E testing, fixed via migration `0016` (already applied to the live dev project per your confirmation).

---

## Improvement roadmap (brainstorming — not implemented, not prioritized as a to-do list)

### Performance, beyond the caching audit
- `POST /api/generate-pdf` re-queries `org_nodes` (`.eq("is_active", true)`) on every PDF export — this is the exact same shape already cached in `src/lib/org-nodes-cache.ts`'s `getAllOrgNodes()`; swapping it in would drop one more redundant DB round trip.
- The "approver directory" pattern (`profiles` filtered by `role = 'DEPARTMENT_HEAD'`, or the full `profiles` table in `/admin/analytics`) is queried independently on `/admin`, `/dashboard`, `/my-submissions`, and `/admin/analytics`. Unlike `org_nodes`/`forms`/`filters`, this data genuinely does need care before caching — profile visibility *is* RLS-scoped per caller in the general case — but each of these four read sites is already permission/role-gated at the app layer first, so the same "service-role client behind an existing gate" pattern used for `org_nodes`/`forms`/`filters` could apply here too if it's worth the complexity for the traffic volume.

### Code duplication
- The `requireXAccess()` app-layer permission helper (SUPER_ADMIN always passes; ADMIN passes only with permission Y) is now hand-copied, nearly verbatim, across 9+ route files: both `org-nodes` routes, both `forms` routes, both `filters` routes, all three `signups` routes, `admin-accounts` (×2, simpler SUPER_ADMIN-only variant), and `users` (a slightly different shape). Extracting a shared `requirePermissionAccess(permission)` (and a separate `requireSuperAdmin()`) into a lib module would remove several hundred duplicated lines and — more importantly — remove the exact risk class this task's own brief called out: one copy quietly drifting from its siblings.

### Missing error handling / silent-failure UX
- Several client mutation handlers (forms/filters, preserved as-is tonight per the "don't change behavior" instruction) surface only a generic "Something went wrong" toast rather than the specific server-side error message, unlike newer routes (signups, org-nodes) which do. Worth an intentional, reviewed pass rather than a silent change.
- Bug #2 above (email desync) is this same class of gap — no compensating action or user-facing warning when a two-step write partially fails.

### Accessibility
- Quick pass only, not a full audit: several icon-only buttons (delete/edit icons in `filters-table.tsx`, `forms-list.tsx`) don't appear to carry an `aria-label` or visually-hidden text alongside the icon — worth a dedicated pass over every icon-only interactive element.

### Preparing for Kawader / AD-Entra
- The `VerificationResult<T>` adapter pattern now has three implementations (`kawader.ts`, `directory.ts`, and tonight's new `fetchEmployeeProfile` — see the Kawader-lookup section of tonight's report). Once a real integration lands and its actual latency/failure/retry behavior is known, it may be worth factoring out shared plumbing (a generic "call external API with a hard timeout and typed fallback" helper) — premature to build that abstraction now, before there's a real API to learn from.
- Whenever Kawader/AD data becomes real, the existing product question flagged in the Sign-Up verified-handoff work (whether/how an externally-reported department or job title should ever reconcile with a person's actual org-chart position) will resurface for this new login-time lookup too — same open design question, not resolved here either (see the hard constraint against touching org-chart/role in tonight's Kawader task).

---

## Overall assessment

This codebase is unusually well-documented and applies a consistent, correctly-reasoned
security philosophy almost everywhere: RLS is treated as the actual source of truth,
and API routes are explicit, fast-failing app-layer checks in front of it rather than
a replacement for it. The inline comments throughout (the `S-01` … `S-14` numbering)
read like the product of several genuine, careful security-hardening passes, and
that discipline shows — most of what I went looking for (permission-check drift,
missing server-side validation, trusting client input) either wasn't there or had
already been addressed. The bugs actually found tonight are real but narrow:
one silent-data-loss risk (form deletion cascading submissions) worth prioritizing,
and a couple of edge-case/partial-failure gaps that are more about hardening than
correctness. The clearest piece of structural debt is the amount of copy-pasted
permission-check boilerplate across routes — not a security problem today (each
copy is currently correct), but a maintainability one that makes the "one route's
check quietly drifts from its sibling" failure mode more likely over time as more
routes get added the same way.
