-- ============================================================================
-- Profile visibility for approval-chain participants (department-agnostic).
--
-- Existing policies only let a DEPARTMENT_HEAD view a submitter's profile
-- when form_submissions.department_id matches their own department_id. That
-- has no equivalent for org-chart routing: an approver who reached a
-- submission purely via approval_chain / org_nodes (and who may have no
-- department_id at all) could see the submission row itself (already granted
-- by "Dept heads view submissions as approver" in 0002_multi_approver.sql)
-- but not the submitter's name/email, since no profiles policy covered it.
--
-- This is one general rule instead of a second department-shaped one: anyone
-- listed as an approver in a submission's `approvals` array may view the
-- profile of the submitter AND of any other approver in that same
-- submission's `approvals` array. It doesn't reference department_id at all,
-- so it applies identically whether the approver got there through the old
-- department system or through org_nodes/approval_chain.
-- ============================================================================

drop policy if exists "Approval chain participants can view related profiles" on profiles;
create policy "Approval chain participants can view related profiles"
  on profiles for select
  using (
    exists (
      select 1
      from form_submissions fs
      where (
        profiles.id = fs.submitted_by
        or exists (
          select 1
          from jsonb_array_elements(fs.approvals) as entry
          where (entry->>'approver_id') = profiles.id::text
        )
      )
      and exists (
        select 1
        from jsonb_array_elements(fs.approvals) as viewer_entry
        where (viewer_entry->>'approver_id') = auth.uid()::text
      )
    )
  );
