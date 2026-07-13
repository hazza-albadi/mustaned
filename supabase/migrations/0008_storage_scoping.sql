-- ============================================================================
-- Scope form-files storage read access to actual submission participants.
--
-- Previously, ANY DEPARTMENT_HEAD could read every file in the bucket
-- (auth_role() in ('SUPER_ADMIN','DEPARTMENT_HEAD') with no per-file check).
-- That's now replaced with the same rule already used to gate table-level
-- access to form_submissions: a department head can read a file only if
-- they're the submitter, an approver listed in that submission's `approvals`
-- array, or the head of the department the submission was routed to. If you
-- can't see the submission row, you can't see its files.
--
-- Files are uploaded to `submissions/<draft_id>/<uploader_id>/<filename>`
-- before the submission row exists (draft_id is generated client-side at the
-- start of filling out a form). form_submissions.draft_id links a submission
-- back to that folder once the row is created, so the storage policy can
-- join on it. Until submit, the uploader can still see their own files via
-- the existing folder-segment-3 owner check.
-- ============================================================================

alter table form_submissions
  add column if not exists draft_id uuid;

create index if not exists idx_submissions_draft_id on form_submissions(draft_id);

drop policy if exists "Owners and dept heads and admins can read form files" on storage.objects;
create policy "Owners, approvers, and admins can read form files"
  on storage.objects for select
  using (
    bucket_id = 'form-files'
    and (
      -- Uploader (also covers files not yet attached to a submitted row)
      auth.uid()::text = (storage.foldername(name))[3]
      or auth_role() = 'SUPER_ADMIN'
      or exists (
        select 1
        from form_submissions fs
        where fs.draft_id::text = (storage.foldername(name))[2]
          and (
            fs.submitted_by = auth.uid()
            or exists (
              select 1
              from jsonb_array_elements(fs.approvals) as entry
              where (entry->>'approver_id') = auth.uid()::text
            )
            or (
              auth_role() = 'DEPARTMENT_HEAD'
              and auth_department_id() = fs.department_id
            )
          )
      )
    )
  );
