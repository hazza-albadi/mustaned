-- ============================================================================
-- Fix: profiles.account_status was declared varchar(20) in
-- 0013_signup_requests.sql, back when the longest value was 'REJECTED' (8
-- chars). 0015_verified_handoff.sql added 'APPROVED_AWAITING_DIRECTORY' (27
-- chars) to the CHECK constraint's allowed values but never widened the
-- column itself — the column's own length limit rejects the value before
-- the CHECK constraint is even evaluated, so every approval failed outright
-- with "value too long for type character varying(20)". Confirmed live via
-- full end-to-end testing.
--
-- Audited the rest of the schema and codebase for the same assumption: no
-- view, index, or TypeScript code (it's a plain string-literal union with no
-- length validation) makes any assumption about this column's length. Two
-- RLS policies do reference it directly, though, and Postgres refuses
-- ALTER COLUMN ... TYPE while any policy depends on the column ("cannot
-- alter type of a column used in a policy definition" — hit on the first
-- attempt to apply this migration):
--   - "Users can update their own profile" (0013/0014/0015) — references it
--     directly in its WITH CHECK row(...) comparison, and via
--     auth_profile_locked_fields()'s return type, which also needs widening
--     for the same reason 0014/0015 already had to touch it.
--   - "Admins with approve_signups can view pending profiles" (0013) —
--     references it directly in its USING clause (`account_status <>
--     'ACTIVE'`).
-- Both are dropped before the ALTER and recreated identically after.
-- auth_is_approved() and auth_role() (also read account_status) are plain
-- functions, not policies — Postgres doesn't track column-level
-- dependencies through a function body, so they aren't affected and don't
-- need touching.
-- ============================================================================

drop policy if exists "Users can update their own profile" on profiles;
drop policy if exists "Admins with approve_signups can view pending profiles" on profiles;
drop function if exists auth_profile_locked_fields();

alter table profiles alter column account_status type varchar(30);

create function auth_profile_locked_fields()
returns table(
  role varchar(50),
  account_status varchar(30),
  is_active boolean,
  civil_id varchar(8),
  email varchar(255),
  civil_id_verification jsonb,
  email_verification jsonb,
  approved_by uuid,
  approved_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select role, account_status, is_active, civil_id, email,
         civil_id_verification, email_verification, approved_by, approved_at
  from profiles where id = auth.uid();
$$;

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and row(
      role, account_status, is_active, civil_id, email,
      civil_id_verification, email_verification, approved_by, approved_at
    ) is not distinct from (
      select row(
        role, account_status, is_active, civil_id, email,
        civil_id_verification, email_verification, approved_by, approved_at
      ) from auth_profile_locked_fields()
    )
  );

create policy "Admins with approve_signups can view pending profiles"
  on profiles for select
  using (
    account_status <> 'ACTIVE'
    and auth_role() = 'ADMIN'
    and auth_has_permission('approve_signups')
  );
