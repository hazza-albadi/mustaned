-- ============================================================================
-- Correct the direction of the Filters feature: it's a category filter on
-- the "Available Forms" listing (which forms a user sees), not a field the
-- submitter fills in. form_submissions never needed its own filter value —
-- a submission's category is derived from its form's filter_ids instead.
--
-- Confirmed live before writing this migration: 0 submissions have
-- filter_id set, so this drops cleanly with zero data loss. filters and
-- forms.filter_ids are unaffected — those stay exactly as built.
-- ============================================================================

alter table form_submissions drop column if exists filter_id;
