-- ============================================================================
-- Granular ADMIN role + per-account permissions.
--
-- ADMIN sits below SUPER_ADMIN: zero access by default until granted specific
-- permissions matching the real /admin pages. SUPER_ADMIN always bypasses
-- this table entirely. Managing ADMIN accounts/permissions is deliberately
-- NOT itself a grantable permission (see the check constraint below — it's
-- not even in the allowed value list) — it stays hardcoded SUPER_ADMIN-only
-- at the application layer to prevent privilege escalation.
-- ============================================================================

alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('SUPER_ADMIN','ADMIN','DEPARTMENT_HEAD','EMPLOYEE'));

create table if not exists admin_permissions (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  permission varchar(50) not null check (permission in (
    'manage_forms', 'manage_org_chart', 'manage_departments',
    'view_analytics', 'view_submissions'
  )),
  granted_by uuid references profiles(id) on delete set null,
  granted_at timestamptz not null default now(),
  unique (profile_id, permission)
);

create index if not exists idx_admin_permissions_profile on admin_permissions(profile_id);

-- Same SECURITY DEFINER pattern as auth_role()/auth_department_id() in
-- 0001_init.sql — bypasses admin_permissions' own RLS so it can be safely
-- called from other tables' policies without recursion.
create or replace function auth_has_permission(perm text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from admin_permissions where profile_id = auth.uid() and permission = perm
  );
$$;

alter table admin_permissions enable row level security;

drop policy if exists "Super Admin full access on admin permissions" on admin_permissions;
create policy "Super Admin full access on admin permissions"
  on admin_permissions for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');

drop policy if exists "Users can view their own admin permissions" on admin_permissions;
create policy "Users can view their own admin permissions"
  on admin_permissions for select
  using (auth.uid() = profile_id);

-- ----------------------------------------------------------------------------
-- Extend existing SUPER_ADMIN-only policies to also admit a permissioned
-- ADMIN. Note: these are the real enforcement layer for forms/org_nodes/
-- departments, since the app writes to those tables using the caller's own
-- session client. Profile writes are a special case — see the comment below
-- the profiles policies.
-- ----------------------------------------------------------------------------

drop policy if exists "Super Admin can manage forms" on forms;
create policy "Super Admin can manage forms"
  on forms for all
  using (auth_role() = 'SUPER_ADMIN' or (auth_role() = 'ADMIN' and auth_has_permission('manage_forms')))
  with check (auth_role() = 'SUPER_ADMIN' or (auth_role() = 'ADMIN' and auth_has_permission('manage_forms')));

drop policy if exists "Admins can view all forms with permission" on forms;
create policy "Admins can view all forms with permission"
  on forms for select
  using (auth_role() = 'ADMIN' and auth_has_permission('view_analytics'));

drop policy if exists "Super Admin full access on org nodes" on org_nodes;
create policy "Super Admin full access on org nodes"
  on org_nodes for all
  using (auth_role() = 'SUPER_ADMIN' or (auth_role() = 'ADMIN' and auth_has_permission('manage_org_chart')))
  with check (auth_role() = 'SUPER_ADMIN' or (auth_role() = 'ADMIN' and auth_has_permission('manage_org_chart')));

drop policy if exists "Super Admin can manage departments" on departments;
create policy "Super Admin can manage departments"
  on departments for all
  using (auth_role() = 'SUPER_ADMIN' or (auth_role() = 'ADMIN' and auth_has_permission('manage_departments')))
  with check (auth_role() = 'SUPER_ADMIN' or (auth_role() = 'ADMIN' and auth_has_permission('manage_departments')));

drop policy if exists "Admins can view submissions with permission" on form_submissions;
create policy "Admins can view submissions with permission"
  on form_submissions for select
  using (
    auth_role() = 'ADMIN'
    and (auth_has_permission('view_submissions') or auth_has_permission('view_analytics'))
  );

-- profiles: kept as defense-in-depth and for consistency, but NOTE — this is
-- NOT the real enforcement for /api/users*. Those routes use the service-role
-- admin client (auth.admin.createUser / admin.from("profiles").update(...)),
-- which bypasses RLS entirely, and new profile rows are inserted by the
-- handle_new_auth_user() trigger (also SECURITY DEFINER, also bypasses RLS).
-- The real guarantee that an ADMIN can only create/edit DEPARTMENT_HEAD or
-- EMPLOYEE profiles is enforced explicitly inside those route handlers.
-- This policy only matters if a future code path writes profiles via the
-- caller's own session client instead of the admin client.
drop policy if exists "Super Admin can insert profiles" on profiles;
create policy "Super Admin can insert profiles"
  on profiles for insert
  with check (
    auth_role() = 'SUPER_ADMIN'
    or (auth_role() = 'ADMIN' and auth_has_permission('manage_org_chart') and role in ('DEPARTMENT_HEAD','EMPLOYEE'))
  );

drop policy if exists "Super Admin can update all profiles" on profiles;
create policy "Super Admin can update all profiles"
  on profiles for update
  using (
    auth_role() = 'SUPER_ADMIN'
    or (auth_role() = 'ADMIN' and auth_has_permission('manage_org_chart') and role in ('DEPARTMENT_HEAD','EMPLOYEE'))
  )
  with check (
    auth_role() = 'SUPER_ADMIN'
    or (auth_role() = 'ADMIN' and auth_has_permission('manage_org_chart') and role in ('DEPARTMENT_HEAD','EMPLOYEE'))
  );
