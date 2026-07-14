-- Read-only. Finds every RLS policy on every table (including storage)
-- whose USING or WITH CHECK clause references department_id or
-- auth_department_id(), so we can see the exact live state before touching
-- the migration again. Also checks for any other function/trigger that
-- mentions department_id, in case there's more than just auth_department_id().

select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where qual ilike '%department%'
   or with_check ilike '%department%'
order by tablename, policyname;

-- Any function (besides auth_department_id) whose body mentions department_id.
-- prokind = 'f' + the namespace filter are pulled into a materialized CTE so
-- pg_get_functiondef() only ever runs on ordinary public-schema functions —
-- calling it on an aggregate's oid (e.g. array_agg, sum) raises 42809, and
-- Postgres doesn't guarantee the outer WHERE clause filters first.
with public_functions as materialized (
  select p.oid, n.nspname as schema, p.proname as function_name
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
)
select schema, function_name, pg_get_functiondef(oid) as definition
from public_functions
where pg_get_functiondef(oid) ilike '%department_id%';

-- Any trigger whose body mentions department_id (handle_new_auth_user etc).
select tgname as trigger_name, tgrelid::regclass as table_name, pg_get_triggerdef(oid) as definition
from pg_trigger
where not tgisinternal
  and pg_get_triggerdef(oid) ilike '%department%';
