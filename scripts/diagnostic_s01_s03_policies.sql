-- Read-only. Checks the actual live definitions of the two policies S-01
-- and S-03 claim to have changed, independent of the received report.
select schemaname, tablename, policyname, cmd, qual, with_check
from pg_policies
where (tablename = 'form_submissions' and policyname = 'Employees insert own submissions')
   or (tablename = 'objects' and policyname ilike '%upload%form files%')
order by tablename, policyname;
