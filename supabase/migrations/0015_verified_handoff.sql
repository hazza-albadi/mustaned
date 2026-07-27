-- ============================================================================
-- Verified handoff: an intermediate account_status between admin approval and
-- full activation, plus storage for the (stubbed) Kawader / directory
-- verification checks run at sign-up time.
--
-- Today, approving a sign-up flips account_status straight to ACTIVE. The new
-- model inserts a step Mustanad does not (and will not) automate: creating
-- the actual directory account. Mustanad has no directory write access and
-- isn't getting any — see the TODO(directory-integration) marker in
-- src/lib/verification/directory.ts. So an approved request now lands in
-- APPROVED_AWAITING_DIRECTORY (is_active stays false, so auth_is_approved()
-- keeps blocking real access exactly as it does for PENDING) until IT/an
-- admin creates the directory account by hand and marks it done via
-- POST /api/signups/[id]/mark-created — the only thing that flips is_active
-- to true and account_status to ACTIVE.
-- ============================================================================

alter table profiles drop constraint if exists profiles_account_status_check;
alter table profiles add constraint profiles_account_status_check
  check (account_status in ('PENDING','ACTIVE','REJECTED','APPROVED_AWAITING_DIRECTORY'));

-- ----------------------------------------------------------------------------
-- Verification results + approval metadata, recorded on the request itself
-- (a sign-up request IS a profiles row — see 0013_signup_requests.sql).
--
-- civil_id_verification / email_verification store the typed
-- VerificationResult<T> (src/lib/verification/types.ts) returned by
-- verifyCivilId()/checkEmailAvailable() at submission time, so the reviewing
-- admin sees exactly what was auto-checked instead of re-deriving it. Both
-- adapters currently always return `{status:"unavailable",...}` — see the
-- TODO(kawader-integration) / TODO(directory-integration) markers in
-- src/lib/verification/kawader.ts and directory.ts.
--
-- approved_by/approved_at record who approved the request and when, for the
-- IT handoff view — nothing previously tracked this.
-- ----------------------------------------------------------------------------

alter table profiles add column if not exists civil_id_verification jsonb;
alter table profiles add column if not exists email_verification jsonb;
alter table profiles add column if not exists approved_by uuid references profiles(id) on delete set null;
alter table profiles add column if not exists approved_at timestamptz;

-- ----------------------------------------------------------------------------
-- handle_new_auth_user() (0001_init.sql, last redefined in
-- 0013_signup_requests.sql) needs to copy the two new verification-result
-- metadata keys onto the new row. Every existing caller (createAuthUser,
-- createAdminAccount) omits them, so they default to null exactly like
-- before this migration — only createSignupUser() passes them. Uses the `->`
-- (jsonb) operator, not `->>` (text): these are jsonb columns and the
-- metadata value is a nested object, not a string.
-- ----------------------------------------------------------------------------

create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, name, name_ar, email, role, civil_id, account_status, is_active,
    civil_id_verification, email_verification
  )
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'name_ar',
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'EMPLOYEE'),
    nullif(new.raw_user_meta_data->>'civil_id', ''),
    coalesce(new.raw_user_meta_data->>'account_status', 'ACTIVE'),
    coalesce((new.raw_user_meta_data->>'is_active')::boolean, true),
    new.raw_user_meta_data->'civil_id_verification',
    new.raw_user_meta_data->'email_verification'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- S-14 (0013_signup_requests.sql) locked role/account_status/is_active/
-- civil_id/email to their stored value on self-update, so a signed-in
-- PENDING account can't rewrite its own approval state via a direct SDK
-- call. The four new columns above are exactly the kind of thing that
-- comment warned about: nothing else validates them, so without locking them
-- too, any signed-in requester could `.from("profiles").update(...)` their
-- own row and fabricate a "verified" result or a fake approved_by/
-- approved_at to mislead whoever reviews the handoff view. (account_status/
-- is_active stay locked either way, so this can't grant real access — it's a
-- data-integrity hole, not an access one — but worth closing the same way.)
-- Same drop-function-and-policy-first dance as
-- 0014_fix_profile_locked_fields_types.sql: CREATE OR REPLACE FUNCTION can't
-- change a function's declared return columns.
-- ----------------------------------------------------------------------------

drop policy if exists "Users can update their own profile" on profiles;
drop function if exists auth_profile_locked_fields();

create function auth_profile_locked_fields()
returns table(
  role varchar(50),
  account_status varchar(20),
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
