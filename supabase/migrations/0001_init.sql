-- ============================================================================
-- Internal Forms & Approval System — Initial Schema, RLS, Storage, Triggers
-- ============================================================================

create extension if not exists "uuid-ossp";

-- ----------------------------------------------------------------------------
-- TABLES
-- ----------------------------------------------------------------------------

create table if not exists departments (
  id uuid primary key default uuid_generate_v4(),
  name varchar(255) not null unique,
  name_ar varchar(255) not null,
  head_id uuid,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name varchar(255) not null,
  name_ar varchar(255),
  email varchar(255) unique not null,
  role varchar(50) not null check (role in ('SUPER_ADMIN','DEPARTMENT_HEAD','EMPLOYEE')),
  department_id uuid references departments(id) on delete set null,
  is_active boolean not null default true,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table departments
  add constraint departments_head_id_fkey foreign key (head_id) references profiles(id) on delete set null;

create table if not exists forms (
  id uuid primary key default uuid_generate_v4(),
  title varchar(255) not null,
  title_ar varchar(255),
  description text,
  description_ar text,
  fields jsonb not null default '[]'::jsonb,
  allowed_departments uuid[],
  requires_approval boolean not null default true,
  requires_comment boolean not null default true,
  is_active boolean not null default true,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists form_submissions (
  id uuid primary key default uuid_generate_v4(),
  form_id uuid not null references forms(id) on delete cascade,
  submitted_by uuid not null references profiles(id) on delete cascade,
  department_id uuid not null references departments(id) on delete restrict,
  data jsonb not null default '{}'::jsonb,
  status varchar(50) not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')),
  approver_id uuid references profiles(id) on delete set null,
  approver_comment text,
  approved_at timestamptz,
  files jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_profiles_department on profiles(department_id);
create index if not exists idx_profiles_role on profiles(role);
create index if not exists idx_forms_active on forms(is_active);
create index if not exists idx_submissions_form on form_submissions(form_id);
create index if not exists idx_submissions_department on form_submissions(department_id);
create index if not exists idx_submissions_submitted_by on form_submissions(submitted_by);
create index if not exists idx_submissions_status on form_submissions(status);

-- ----------------------------------------------------------------------------
-- updated_at trigger
-- ----------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_departments_updated_at on departments;
create trigger trg_departments_updated_at before update on departments
  for each row execute function set_updated_at();

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

drop trigger if exists trg_forms_updated_at on forms;
create trigger trg_forms_updated_at before update on forms
  for each row execute function set_updated_at();

drop trigger if exists trg_submissions_updated_at on form_submissions;
create trigger trg_submissions_updated_at before update on form_submissions
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Auto-create profile when a new auth.users row is inserted.
-- Reads role/department_id/name from raw_user_meta_data (set at creation time
-- via the Supabase Admin API, e.g. by the seed script or /admin/users page).
-- ----------------------------------------------------------------------------

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, name_ar, email, role, department_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'name_ar',
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'EMPLOYEE'),
    nullif(new.raw_user_meta_data->>'department_id', '')::uuid
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table profiles enable row level security;
alter table departments enable row level security;
alter table forms enable row level security;
alter table form_submissions enable row level security;

-- ----------------------------------------------------------------------------
-- RLS helper functions.
--
-- IMPORTANT: policies on `profiles` must never query `profiles` directly in
-- their USING/WITH CHECK clause (even via another table's policy) — Postgres
-- re-evaluates `profiles`' own RLS policies for that subquery, which
-- re-evaluates them again, etc., raising "infinite recursion detected in
-- policy for relation \"profiles\"" (42P17) and breaking every query against
-- the table, including a user reading their own row. SECURITY DEFINER
-- functions run with the privileges of their owner (which bypasses RLS),
-- so looking up the caller's role/department through them does not
-- re-trigger `profiles`' policies.
-- ----------------------------------------------------------------------------

create or replace function auth_role()
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function auth_department_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select department_id from profiles where id = auth.uid();
$$;

-- PROFILES -------------------------------------------------------------------

drop policy if exists "Users can view their own profile" on profiles;
create policy "Users can view their own profile"
  on profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can update their own profile" on profiles;
create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id);

drop policy if exists "Super Admin can view all profiles" on profiles;
create policy "Super Admin can view all profiles"
  on profiles for select
  using (auth_role() = 'SUPER_ADMIN');

drop policy if exists "Super Admin can update all profiles" on profiles;
create policy "Super Admin can update all profiles"
  on profiles for update
  using (auth_role() = 'SUPER_ADMIN');

drop policy if exists "Super Admin can insert profiles" on profiles;
create policy "Super Admin can insert profiles"
  on profiles for insert
  with check (auth_role() = 'SUPER_ADMIN');

drop policy if exists "Super Admin can delete profiles" on profiles;
create policy "Super Admin can delete profiles"
  on profiles for delete
  using (auth_role() = 'SUPER_ADMIN');

-- Department heads need to see the names of employees in their own department
-- (e.g. to display "submitted by" on the admin panel).
drop policy if exists "Department heads can view dept profiles" on profiles;
create policy "Department heads can view dept profiles"
  on profiles for select
  using (
    auth_role() = 'DEPARTMENT_HEAD'
    and auth_department_id() = profiles.department_id
  );

-- An employee can submit a request routed to a department other than their
-- own (e.g. a Transfer Request). That department's head still needs to see
-- the submitter's name, even though the submitter's home department differs
-- from the one the request was routed to.
drop policy if exists "Department heads can view submitter profiles" on profiles;
create policy "Department heads can view submitter profiles"
  on profiles for select
  using (
    auth_role() = 'DEPARTMENT_HEAD'
    and exists (
      select 1 from form_submissions fs
      where fs.submitted_by = profiles.id
        and fs.department_id = auth_department_id()
    )
  );

-- DEPARTMENTS ------------------------------------------------------------------

drop policy if exists "Everyone can view active departments" on departments;
create policy "Everyone can view active departments"
  on departments for select
  using (is_active = true);

drop policy if exists "Super Admin can manage departments" on departments;
create policy "Super Admin can manage departments"
  on departments for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

-- FORMS --------------------------------------------------------------------

drop policy if exists "Everyone can view active forms" on forms;
create policy "Everyone can view active forms"
  on forms for select
  using (is_active = true);

drop policy if exists "Super Admin can manage forms" on forms;
create policy "Super Admin can manage forms"
  on forms for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

-- FORM SUBMISSIONS -----------------------------------------------------------

drop policy if exists "Employees view own submissions" on form_submissions;
create policy "Employees view own submissions"
  on form_submissions for select
  using (auth.uid() = submitted_by);

drop policy if exists "Employees insert own submissions" on form_submissions;
create policy "Employees insert own submissions"
  on form_submissions for insert
  with check (auth.uid() = submitted_by);

drop policy if exists "Department heads view dept submissions" on form_submissions;
create policy "Department heads view dept submissions"
  on form_submissions for select
  using (
    auth_role() = 'DEPARTMENT_HEAD'
    and auth_department_id() = form_submissions.department_id
  );

drop policy if exists "Department heads update dept pending" on form_submissions;
create policy "Department heads update dept pending"
  on form_submissions for update
  using (
    auth_role() = 'DEPARTMENT_HEAD'
    and auth_department_id() = form_submissions.department_id
    and status = 'PENDING'
  )
  with check (
    auth_role() = 'DEPARTMENT_HEAD'
    and auth_department_id() = form_submissions.department_id
  );

drop policy if exists "Super Admin full access" on form_submissions;
create policy "Super Admin full access"
  on form_submissions for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

-- ----------------------------------------------------------------------------
-- STORAGE — form-files bucket
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('form-files', 'form-files', false)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload form files" on storage.objects;
create policy "Authenticated users can upload form files"
  on storage.objects for insert
  with check (
    bucket_id = 'form-files'
    and auth.role() = 'authenticated'
  );

drop policy if exists "Owners and dept heads and admins can read form files" on storage.objects;
create policy "Owners and dept heads and admins can read form files"
  on storage.objects for select
  using (
    bucket_id = 'form-files'
    and (
      auth.uid()::text = (storage.foldername(name))[3]
      or auth_role() in ('SUPER_ADMIN', 'DEPARTMENT_HEAD')
    )
  );

drop policy if exists "Owners and admins can delete form files" on storage.objects;
create policy "Owners and admins can delete form files"
  on storage.objects for delete
  using (
    bucket_id = 'form-files'
    and (
      auth.uid()::text = (storage.foldername(name))[3]
      or auth_role() = 'SUPER_ADMIN'
    )
  );
