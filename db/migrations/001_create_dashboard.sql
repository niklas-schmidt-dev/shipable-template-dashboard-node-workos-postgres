create table if not exists dashboard_metrics (
  id text primary key,
  workos_subject text,
  label text not null,
  value text not null,
  delta text not null,
  sort_order integer not null default 0
);

create table if not exists account_health (
  id text primary key,
  workos_subject text,
  name text not null,
  health text not null check (health in ('Strong', 'Watch', 'Risk')),
  value text not null,
  owner text not null default 'Unassigned',
  next_step text not null default 'Review account'
);

create table if not exists incidents (
  id text primary key,
  workos_subject text,
  title text not null,
  severity text not null check (severity in ('low', 'medium', 'high')),
  status text not null check (status in ('open', 'monitoring', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists dashboard_metrics_sort_idx
  on dashboard_metrics (workos_subject, sort_order asc);

create index if not exists account_health_workos_subject_idx
  on account_health (workos_subject);

create index if not exists account_health_priority_idx
  on account_health (workos_subject, health, name);

create index if not exists incidents_status_created_idx
  on incidents (workos_subject, status, created_at desc);
