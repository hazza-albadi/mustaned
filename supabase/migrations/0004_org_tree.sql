-- ============================================================================
-- Position-based org tree
--
-- A node is a permanent position/job title with a fixed id. Approval routing
-- references node ids, never person ids directly — a person is optionally
-- assigned to a node, and a vacant node (assigned_profile_id null, or
-- deactivated) blocks any submission whose approval_chain routes through it.
-- ============================================================================

create table if not exists org_nodes (
  id uuid primary key default uuid_generate_v4(),
  title varchar(255) not null,
  parent_id uuid references org_nodes(id) on delete set null,
  assigned_profile_id uuid references profiles(id) on delete set null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_org_nodes_parent on org_nodes(parent_id);
create index if not exists idx_org_nodes_assigned_profile on org_nodes(assigned_profile_id);

-- A person can hold at most one position at a time.
create unique index if not exists idx_org_nodes_assigned_profile_unique
  on org_nodes(assigned_profile_id) where assigned_profile_id is not null;

drop trigger if exists trg_org_nodes_updated_at on org_nodes;
create trigger trg_org_nodes_updated_at before update on org_nodes
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- FORMS — new node-based approval chain.
--
-- Each entry: { type: 'node', node_id: uuid, label: string }
--          or { type: 'direct_manager', label: string }
-- required_approvers (uuid/text[] of literal approver ids) is kept as-is for
-- forms saved before this migration; the app falls back to it when a form
-- has no approval_chain.
-- ----------------------------------------------------------------------------

alter table forms
  add column if not exists approval_chain jsonb not null default '[]';

-- ----------------------------------------------------------------------------
-- ROW LEVEL SECURITY
-- ----------------------------------------------------------------------------

alter table org_nodes enable row level security;

-- Mirrors the existing "Everyone can view active departments/forms" pattern —
-- any authenticated user can read active nodes (needed client-side to
-- resolve their own node and approval_chain steps at submission time).
drop policy if exists "Everyone can view active org nodes" on org_nodes;
create policy "Everyone can view active org nodes"
  on org_nodes for select
  using (is_active = true);

drop policy if exists "Super Admin full access on org nodes" on org_nodes;
create policy "Super Admin full access on org nodes"
  on org_nodes for all
  using (auth_role() = 'SUPER_ADMIN')
  with check (auth_role() = 'SUPER_ADMIN');
