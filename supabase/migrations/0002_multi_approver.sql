-- ============================================================================
-- Multi-approver flow
-- Adds:
--   forms.required_approvers   uuid[]   — ordered list of approver user IDs
--   form_submissions.approvals jsonb    — per-approver decision records
-- Overall submission status is:
--   REJECTED  → the moment any single approver rejects
--   APPROVED  → only when EVERY required approver has approved
--   PENDING   → all other states
-- ============================================================================

-- Add required_approvers column to forms
ALTER TABLE forms
  ADD COLUMN IF NOT EXISTS required_approvers uuid[] NOT NULL DEFAULT '{}';

-- Add approvals column to form_submissions.
-- Each element is a JSON object:
--   { "approver_id": "<uuid>", "status": "PENDING"|"APPROVED"|"REJECTED",
--     "comment": "<text>"|null, "decided_at": "<iso8601>"|null }
ALTER TABLE form_submissions
  ADD COLUMN IF NOT EXISTS approvals jsonb NOT NULL DEFAULT '[]';

-- Index to let queries "which submissions need my action?" run efficiently.
CREATE INDEX IF NOT EXISTS idx_submissions_approvals
  ON form_submissions USING gin (approvals);

-- ============================================================================
-- RLS — keep existing policies, add new ones for the multi-approver flow.
--
-- A department head can now see any submission that lists them inside the
-- approvals JSONB array, regardless of which department the submission was
-- routed to. The old department-scoped policies remain so that heads still see
-- submissions submitted directly to their department (backwards compatibility).
-- ============================================================================

-- SELECT: dept head sees submissions where their ID is in approvals
drop policy if exists "Dept heads view submissions as approver" on form_submissions;
create policy "Dept heads view submissions as approver"
  on form_submissions for select
  using (
    auth_role() = 'DEPARTMENT_HEAD'
    and exists (
      select 1
      from jsonb_array_elements(form_submissions.approvals) as entry
      where (entry->>'approver_id') = auth.uid()::text
    )
  );

-- UPDATE: dept head may update a submission only while their own entry is PENDING.
-- The old "Department heads update dept pending" policy is kept alongside this one
-- so that the single-approver (department-based) flow keeps working too.
drop policy if exists "Dept heads update their own approval entry" on form_submissions;
create policy "Dept heads update their own approval entry"
  on form_submissions for update
  using (
    auth_role() = 'DEPARTMENT_HEAD'
    and exists (
      select 1
      from jsonb_array_elements(form_submissions.approvals) as entry
      where (entry->>'approver_id') = auth.uid()::text
        and (entry->>'status') = 'PENDING'
    )
  )
  with check (
    auth_role() = 'DEPARTMENT_HEAD'
    and exists (
      select 1
      from jsonb_array_elements(form_submissions.approvals) as entry
      where (entry->>'approver_id') = auth.uid()::text
    )
  );
