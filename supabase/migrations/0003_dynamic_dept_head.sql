-- ============================================================================
-- Dynamic "Employee's Department Head" approver sentinel
--
-- forms.required_approvers was declared as uuid[]. The form builder can now
-- store the sentinel string 'DYNAMIC_DEPT_HEAD' alongside real approver
-- UUIDs — it gets resolved to the submitting employee's actual current
-- department head at submission time (src/lib/approval-chain.ts), never
-- persisted as a resolved value on the form itself. uuid[] rejects any
-- non-UUID text, so the column must widen to text[] to hold the sentinel.
-- Existing UUID entries cast losslessly to their text representation.
-- ============================================================================

ALTER TABLE forms
  ALTER COLUMN required_approvers TYPE text[] USING required_approvers::text[];
