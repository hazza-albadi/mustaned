-- ============================================================================
-- Fix auth_profile_locked_fields()'s declared return types.
--
-- 0013_signup_requests.sql declared this SECURITY DEFINER function as
-- `returns table(role text, account_status text, is_active boolean,
-- civil_id text, email text)`, but the real profiles columns are
-- varchar(50)/varchar(20)/boolean/varchar(8)/varchar(255). Comparing
-- row(role, account_status, is_active, civil_id, email) — read straight off
-- profiles, so varchar — against row(...) from this function — declared
-- text — in "Users can update their own profile"'s WITH CHECK made Postgres
-- raise "cannot compare dissimilar column types character varying and text
-- at record column 1" on every single self-update, benign or malicious
-- alike, instead of ever evaluating the intended IS NOT DISTINCT FROM
-- comparison. Confirmed live: this technically still blocked a
-- self-promotion attempt (an error is still a block) but also blocked every
-- legitimate self-edit (e.g. renaming yourself), which defeats the point of
-- still allowing name/name_ar/avatar_url to be self-editable.
--
-- CREATE OR REPLACE FUNCTION cannot change a function's declared return
-- column types, so the function has to be dropped and recreated — which in
-- turn requires dropping the policy that depends on it first, since Postgres
-- tracks RLS policy expressions' function references as real dependencies.
-- ============================================================================

drop policy if exists "Users can update their own profile" on profiles;
drop function if exists auth_profile_locked_fields();

create function auth_profile_locked_fields()
returns table(role varchar(50), account_status varchar(20), is_active boolean, civil_id varchar(8), email varchar(255))
language sql
security definer
stable
set search_path = public
as $$
  select role, account_status, is_active, civil_id, email from profiles where id = auth.uid();
$$;

create policy "Users can update their own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id
    and row(role, account_status, is_active, civil_id, email) is not distinct from (
      select row(role, account_status, is_active, civil_id, email) from auth_profile_locked_fields()
    )
  );
