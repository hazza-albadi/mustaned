-- ============================================================================
-- Remove the "Assistant Vice Chancellor at the Branches" org node
--
-- This position (and its two sub-branches: "Assistant Vice Chancellor at the
-- Branch" and "Dean of Specialized College / Academy", 85 descendant nodes
-- total) does not apply to Mustanad's own branch/college and is not part of
-- its org structure. Confirmed before writing this migration: no org_nodes
-- row in the subtree has an assigned_profile_id, and no form's
-- approval_chain references any node id in the subtree — safe to remove the
-- whole branch outright rather than re-parenting anything.
--
-- Looked up by title (not a hardcoded UUID) and removed recursively via
-- parent_id, so this doesn't depend on this environment's exact seeded ids.
-- ============================================================================

with recursive subtree as (
  select id from org_nodes
  where title = 'Assistant Vice Chancellor at the Branches - Deans of Specialized Colleges and Academies'
  union all
  select n.id from org_nodes n
  join subtree s on n.parent_id = s.id
)
delete from org_nodes where id in (select id from subtree);
