-- ============================================================================
-- Make form_submissions.department_id optional.
--
-- The departments table (Engineering/IT/HR/Finance/Business) is scaffolding
-- from before org_nodes existed. Routing and access are now resolved via
-- approval_chain / org_nodes / the approvals jsonb array — an employee whose
-- only "position" is an org node (no row in the legacy departments table)
-- must still be able to submit forms.
-- ============================================================================

alter table form_submissions alter column department_id drop not null;
