-- H1N1 · esquema inicial. Postgres >= 14 (PGlite compatível).
create table if not exists schema_migrations (
  name text primary key,
  applied_at timestamptz not null default now()
);

create table if not exists sources (
  id text primary key,
  slug text not null unique,
  name text not null,
  agency text not null,
  country text not null,
  region text not null,
  category text not null,
  access text not null,
  access_type text not null check (access_type in ('api','open_data','portal')),
  h1n1_scope text not null,
  update_cadence text not null,
  priority text not null check (priority in ('P0','P1','P2')),
  url text not null,
  notes text not null default '',
  license text not null default 'verify_per_source',
  mirror_group text,
  api_tested_at date
);

create table if not exists snapshots (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references sources(id),
  url text not null,
  fetched_at timestamptz not null default now(),
  sha256 text not null,
  bytes bigint,
  content_type text,
  license text,
  storage_path text,
  data_as_of date,
  status text not null check (status in ('ok','failed','quarantined')),
  notes text
);
create index if not exists snapshots_source_idx on snapshots(source_id, fetched_at desc);

create table if not exists indicators (
  id text primary key,
  name text not null,
  description text not null,
  source_id text not null references sources(id),
  case_definition text not null,
  measurement text not null check (measurement in ('count','rate','percent')),
  unit text not null,
  universe_note text not null,
  methodology_version text not null,
  geo_levels text[] not null,
  period_type text not null check (period_type in ('epiweek','isoweek','month','year')),
  event_date_basis text not null,
  stratum_schema jsonb not null default '{}'::jsonb,
  mirror_group text,
  suppression_threshold int not null default 0,
  denominator_indicator_id text,
  min_denominator int,
  caveats text[] not null default '{}'
);

create table if not exists observations (
  id bigserial primary key,
  indicator_id text not null references indicators(id),
  snapshot_id uuid not null references snapshots(id),
  geo_level text not null check (geo_level in ('world','country','region','state')),
  geo_code text not null,
  period_type text not null check (period_type in ('epiweek','isoweek','month','year')),
  period text not null,
  period_start date not null,
  period_end date not null,
  value numeric,
  denominator numeric,
  stratum jsonb not null default '{}'::jsonb,
  stratum_key text not null default '',
  update_status text not null default 'provisional' check (update_status in ('provisional','final')),
  quality_flags text[] not null default '{}',
  constraint observations_unique unique (indicator_id, snapshot_id, geo_level, geo_code, period_type, period, stratum_key),
  constraint observations_period_order check (period_end >= period_start)
);
create index if not exists observations_lookup_idx
  on observations(indicator_id, geo_level, geo_code, period_type, period, stratum_key);
create index if not exists observations_snapshot_idx on observations(snapshot_id);

-- Publicação vigente por indicador: a API só serve snapshots com status 'current'.
create table if not exists indicator_publications (
  id bigserial primary key,
  indicator_id text not null references indicators(id),
  snapshot_id uuid not null references snapshots(id),
  published_at timestamptz not null default now(),
  superseded_at timestamptz,
  status text not null check (status in ('current','superseded','rejected')),
  data_as_of date,
  validation_report jsonb not null default '{}'::jsonb
);
create unique index if not exists indicator_publications_one_current
  on indicator_publications(indicator_id) where status = 'current';

create table if not exists ingestion_runs (
  id bigserial primary key,
  source_id text not null references sources(id),
  connector text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status text not null check (status in ('running','ok','failed','quarantined')),
  rows_in bigint not null default 0,
  rows_out bigint not null default 0,
  snapshot_id uuid references snapshots(id),
  error text,
  params jsonb not null default '{}'::jsonb
);

create table if not exists geo (
  code text primary key,           -- BRA, BR-SP, WLD, GBR...
  level text not null check (level in ('world','country','region','state')),
  name text not null,
  parent_code text,
  ibge_id text,
  iso2 text
);

-- Fatos citados (datas e marcos documentados), distintos de indicadores.
create table if not exists facts (
  id text primary key,
  claim text not null,
  source_title text not null,
  source_url text not null,
  quote text,
  verified_by text,
  verified_at date,
  notes text
);
