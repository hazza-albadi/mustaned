-- ============================================================================
-- Scaffolding for a Kawader employee-data lookup at login (name, department,
-- phone, job/position path) — NOT a working integration. Kawader API docs
-- and credentials are still unavailable; src/lib/verification/kawader.ts's
-- new fetchEmployeeProfile() always returns "unavailable" today, exactly
-- like verifyCivilId() already does. This migration only adds somewhere to
-- store a real result once one exists.
--
-- IMPORTANT — confirmed directly against the schema and every account-
-- creation path before writing this: civil_id is NOT populated for most
-- accounts. create-auth-user.ts and create-admin-account.ts (the only two
-- paths that provision EMPLOYEE/DEPARTMENT_HEAD/ADMIN/SUPER_ADMIN accounts
-- today) never set it — only self-service Sign Up
-- (create-signup-user.ts, currently SIGNUP_ENABLED = false) ever does. That
-- means, as of tonight, *every* real account in this system has civil_id =
-- null, so this lookup currently has nothing to key on for anyone. That's
-- expected and fine (harmless no-op — see the login wiring in login-form.tsx
-- and the new /api/auth/kawader-sync route), but it means this feature is
-- effectively dormant until either Sign Up is enabled or civil_id starts
-- being collected some other way. Flagging this plainly rather than
-- quietly limiting the feature's real-world effect without saying so.
--
-- Purely additive, purely informational columns — deliberately separate
-- from anything the org chart/approval-routing system manages (org_nodes,
-- profiles.role). Nothing here is ever written to org_nodes or role; see
-- the hard constraint in the login wiring.
-- ============================================================================

alter table profiles add column if not exists kawader_full_name varchar(255);
alter table profiles add column if not exists kawader_full_name_ar varchar(255);
alter table profiles add column if not exists kawader_department varchar(255);
alter table profiles add column if not exists kawader_phone varchar(50);
alter table profiles add column if not exists kawader_job_path text;
alter table profiles add column if not exists kawader_synced_at timestamptz;

-- ----------------------------------------------------------------------------
-- Same self-update lock extension as 0015/0016 (civil_id_verification/
-- email_verification, approved_by/approved_at): these 6 columns are meant
-- to be written only by the server-side kawader-sync route using the
-- service-role client, never by the account holder themselves. Without
-- locking them, a signed-in user could `.from("profiles").update(...)`
-- their own row directly and fabricate a fake Kawader-verified department/
-- job path — same data-integrity class of issue those columns were locked
-- down for, not an access-control one (nothing here grants real access on
-- its own).
-- ----------------------------------------------------------------------------

drop policy if exists "Users can update their own profile" on profiles;
drop function if exists auth_profile_locked_fields();

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
  approved_at timestamptz,
  kawader_full_name varchar(255),
  kawader_full_name_ar varchar(255),
  kawader_department varchar(255),
  kawader_phone varchar(50),
  kawader_job_path text,
  kawader_synced_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select role, account_status, is_active, civil_id, email,
         civil_id_verification, email_verification, approved_by, approved_at,
         kawader_full_name, kawader_full_name_ar, kawader_department,
         kawader_phone, kawader_job_path, kawader_synced_at
  from profiles where id = auth.uid();
$$;

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and row(
      role, account_status, is_active, civil_id, email,
      civil_id_verification, email_verification, approved_by, approved_at,
      kawader_full_name, kawader_full_name_ar, kawader_department,
      kawader_phone, kawader_job_path, kawader_synced_at
    ) is not distinct from (
      select row(
        role, account_status, is_active, civil_id, email,
        civil_id_verification, email_verification, approved_by, approved_at,
        kawader_full_name, kawader_full_name_ar, kawader_department,
        kawader_phone, kawader_job_path, kawader_synced_at
      ) from auth_profile_locked_fields()
    )
  );
