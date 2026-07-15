-- ============================================================================
-- Generic "Filters" feature — purely a display/sort categorization tag on
-- submissions (e.g. branch/location), NOT the removed departments feature.
-- Deliberately has no bearing on who can see or fill anything: RLS below
-- only gates writing filter definitions (matching every other admin-managed
-- table's "Super Admin can manage X" pattern) and lets anyone read active
-- ones (needed to show the picker on the fill page) — no policy here ever
-- touches forms/form_submissions visibility.
-- ============================================================================

create table if not exists filters (
  id uuid primary key default uuid_generate_v4(),
  name varchar(255) not null unique,
  name_ar varchar(255) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_filters_updated_at on filters;
create trigger trg_filters_updated_at before update on filters
  for each row execute function set_updated_at();

alter table filters enable row level security;

drop policy if exists "Everyone can view active filters" on filters;
create policy "Everyone can view active filters"
  on filters for select
  using (is_active = true);

drop policy if exists "Super Admin can manage filters" on filters;
create policy "Super Admin can manage filters"
  on filters for all
  using (auth_role() = 'SUPER_ADMIN' or (auth_role() = 'ADMIN' and auth_has_permission('manage_filters')))
  with check (auth_role() = 'SUPER_ADMIN' or (auth_role() = 'ADMIN' and auth_has_permission('manage_filters')));

-- Which filters apply to a form (the set of choices offered on the fill
-- page) — a bare array like the old allowed_departments uuid[], no FK on
-- individual elements.
alter table forms add column if not exists filter_ids uuid[] not null default '{}';

-- Which one the submitter picked. No NOT NULL — most forms have zero
-- filters attached and never set this.
alter table form_submissions add column if not exists filter_id uuid references filters(id) on delete set null;

alter table admin_permissions drop constraint if exists admin_permissions_permission_check;
alter table admin_permissions add constraint admin_permissions_permission_check
  check (permission in ('manage_forms', 'manage_org_chart', 'view_analytics', 'view_submissions', 'manage_filters'));
