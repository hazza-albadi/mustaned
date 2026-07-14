-- ============================================================================
-- Remove the departments feature entirely.
--
-- Confirmed before writing this migration: 0 of 11 forms use a restricted
-- allowed_departments, 0 of 6 form_submissions have department_id set — the
-- legacy department-based routing/visibility path (parallel to the
-- org_nodes/approval_chain system) currently contributes nothing. The 5 demo
-- DEPARTMENT_HEAD accounts (Engineering/IT/HR/Finance/Business Head) that
-- only had department_id and no org_nodes position are left as-is per
-- explicit confirmation — they simply have no queue until assigned a
-- position, same as any other unassigned DEPARTMENT_HEAD account.
--
-- Live-schema audit (pg_policies / pg_proc, since the migrations directory
-- had drifted from the actual database): confirmed the full, exact set of
-- objects depending on auth_department_id()/department_id below. Notably,
-- "Department heads update dept pending" (0001_init.sql) no longer exists
-- under that name — it was replaced at some point, outside of a migration
-- file, by "Department heads decide legacy submissions" (same role/
-- department check, tightened to only fire when a submission's approvals
-- array is still empty, so it doesn't collide with the newer per-approver
-- "Dept heads update their own approval entry" policy). Dropped explicitly
-- by its real name below instead of relying on the stale one.
-- ============================================================================

-- Policies referencing auth_department_id() / department_id must go before
-- the function and columns they depend on.
drop policy if exists "Department heads can view dept profiles" on profiles;
drop policy if exists "Department heads can view submitter profiles" on profiles;
drop policy if exists "Department heads view dept submissions" on form_submissions;
drop policy if exists "Department heads decide legacy submissions" on form_submissions;

-- Storage read policy: drop the department-head clause, keep the rest
-- (uploader / SUPER_ADMIN / submitter / approvals-array approver) intact.
drop policy if exists "Owners, approvers, and admins can read form files" on storage.objects;
create policy "Owners, approvers, and admins can read form files"
  on storage.objects for select
  using (
    bucket_id = 'form-files'
    and (
      auth.uid()::text = (storage.foldername(name))[3]
      or auth_role() = 'SUPER_ADMIN'
      or exists (
        select 1
        from form_submissions fs
        where fs.draft_id::text = (storage.foldername(name))[2]
          and (
            fs.submitted_by = auth.uid()
            or exists (
              select 1
              from jsonb_array_elements(fs.approvals) as entry
              where (entry->>'approver_id') = auth.uid()::text
            )
          )
      )
    )
  );

drop function if exists auth_department_id();

alter table forms drop column if exists allowed_departments;
alter table form_submissions drop column if exists department_id;
alter table profiles drop column if exists department_id;

drop table if exists departments;

-- handle_new_auth_user() (0001_init.sql) inserted department_id from
-- raw_user_meta_data on every signup — must be redefined now that the
-- column is gone, or every future signup fails.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, name_ar, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'name_ar',
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'EMPLOYEE')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

delete from admin_permissions where permission = 'manage_departments';

alter table admin_permissions drop constraint if exists admin_permissions_permission_check;
alter table admin_permissions add constraint admin_permissions_permission_check
  check (permission in ('manage_forms', 'manage_org_chart', 'view_analytics', 'view_submissions'));
