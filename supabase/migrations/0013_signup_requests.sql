-- ============================================================================
-- Self-service Sign Up, gated by admin approval.
--
-- No Kawader integration yet to auto-verify a new person's identity, so a
-- self-registered account can't be trusted immediately: the auth user +
-- password are created right away (their credentials are real and ready),
-- but the profile sits in a PENDING account_status until an admin with the
-- new approve_signups permission reviews it.
--
-- civil_id is the future Kawader matching key (ASSUMPTION: Omani Civil ID is
-- an 8-digit number — no authoritative spec was available in this repo to
-- confirm the exact format, flagged separately). account_status is a new
-- tri-state column, kept alongside the existing is_active rather than
-- overloading it: is_active has always meant "enabled/visible" and — until
-- now — was never actually flipped to false by any code path (the org node
-- "Deactivate" button toggles org_nodes.is_active, not profiles.is_active),
-- so it can't by itself distinguish PENDING from REJECTED. A signup profile
-- is created with is_active = false specifically so it stays invisible to
-- the existing, unmodified "unassigned profiles" pickers (org-tree-content.tsx,
-- add-position-dialog.tsx, org-node-edit-dialog.tsx all filter on
-- `is_active`) until approval flips it back to true.
-- ============================================================================

alter table profiles add column if not exists civil_id varchar(8);
alter table profiles drop constraint if exists profiles_civil_id_format;
alter table profiles add constraint profiles_civil_id_format
  check (civil_id is null or civil_id ~ '^[0-9]{8}$');
alter table profiles drop constraint if exists profiles_civil_id_unique;
alter table profiles add constraint profiles_civil_id_unique unique (civil_id);

alter table profiles add column if not exists account_status varchar(20) not null default 'ACTIVE';
alter table profiles drop constraint if exists profiles_account_status_check;
alter table profiles add constraint profiles_account_status_check
  check (account_status in ('PENDING','ACTIVE','REJECTED'));

alter table admin_permissions drop constraint if exists admin_permissions_permission_check;
alter table admin_permissions add constraint admin_permissions_permission_check
  check (permission in (
    'manage_forms', 'manage_org_chart', 'view_analytics', 'view_submissions',
    'manage_filters', 'approve_signups'
  ));

-- ----------------------------------------------------------------------------
-- handle_new_auth_user() (0001_init.sql, last redefined in
-- 0010_remove_departments.sql) needs to read the three new metadata keys.
-- Every existing caller (createAuthUser, createAdminAccount) omits them, so
-- the coalesce() defaults below (null / 'ACTIVE' / true) exactly reproduce
-- today's behavior for those — only the new signup path passes
-- account_status: 'PENDING', is_active: false.
-- ----------------------------------------------------------------------------

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, name_ar, email, role, civil_id, account_status, is_active)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'name_ar',
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'EMPLOYEE'),
    nullif(new.raw_user_meta_data->>'civil_id', ''),
    coalesce(new.raw_user_meta_data->>'account_status', 'ACTIVE'),
    coalesce((new.raw_user_meta_data->>'is_active')::boolean, true)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- RLS
-- ----------------------------------------------------------------------------

-- Admins with approve_signups (and SUPER_ADMIN, already covered by its own
-- blanket "can view all profiles" policy) need to see PENDING/REJECTED
-- profiles to render the review queue. Mirrors the auth_has_permission()
-- pattern from 0007_admin_permissions.sql exactly.
drop policy if exists "Admins with approve_signups can view pending profiles" on profiles;
create policy "Admins with approve_signups can view pending profiles"
  on profiles for select
  using (
    account_status <> 'ACTIVE'
    and auth_role() = 'ADMIN'
    and auth_has_permission('approve_signups')
  );

-- S-14: "Users can update their own profile" (0001_init.sql) was created
-- without a WITH CHECK clause, which Postgres silently defaults to the same
-- expression as USING — meaning any authenticated user could already call
-- `.from("profiles").update(...)` directly from the browser client and
-- rewrite their OWN role/is_active/etc with zero enforcement. No existing
-- app code happens to exploit this (every real profile write goes through a
-- service-role API route instead), so it has been latent — but a
-- self-registered PENDING account is the first profile that legitimately
-- holds a valid Supabase session while explicitly not supposed to have
-- access, turning this into a live self-approval/self-promotion hole the
-- moment sign-up ships. Lock the security-sensitive columns to their current
-- stored value via a SECURITY DEFINER lookup — same recursion-safe pattern
-- as auth_role()/auth_department_id() (see the big comment above those in
-- 0001_init.sql for why a SECURITY DEFINER function reading `profiles` can
-- safely be called from `profiles`' own policy without tripping "infinite
-- recursion detected in policy for relation \"profiles\""). name/name_ar/
-- avatar_url stay freely self-editable, unchanged from today.
create or replace function auth_profile_locked_fields()
returns table(role text, account_status text, is_active boolean, civil_id text, email text)
language sql
security definer
stable
set search_path = public
as $$
  select role, account_status, is_active, civil_id, email from profiles where id = auth.uid();
$$;

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and row(role, account_status, is_active, civil_id, email) is not distinct from (
      select row(role, account_status, is_active, civil_id, email) from auth_profile_locked_fields()
    )
  );

-- S-14: a PENDING or REJECTED account holds a genuinely valid Supabase
-- session from the moment it signs up (the auth user + password are created
-- immediately) — app-layer/middleware gating keeps it out of the UI, but per
-- the existing S-01 precedent (see the comment in
-- src/app/api/submissions/route.ts: RLS is "a real second gate, not just
-- this route's say-so") a direct SDK/API call must be blocked too. Both
-- policies below previously only checked ownership/authentication, never
-- account status.
create or replace function auth_is_approved()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select account_status = 'ACTIVE' and is_active from profiles where id = auth.uid()),
    false
  );
$$;

drop policy if exists "Employees insert own submissions" on form_submissions;
create policy "Employees insert own submissions"
  on form_submissions for insert
  with check (auth.uid() = submitted_by and auth_is_approved());

drop policy if exists "Authenticated users can upload form files" on storage.objects;
create policy "Authenticated users can upload form files"
  on storage.objects for insert
  with check (
    bucket_id = 'form-files'
    and auth.role() = 'authenticated'
    and auth_is_approved()
  );
