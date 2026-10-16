// SQL migrations, applied in order at start-up and recorded in schema_migrations.
// Never edit a migration that has run anywhere shared; add a new one.
export const MIGRATIONS: { id: string; sql: string }[] = [
  {
    id: '0001_init',
    sql: /* sql */ `
-- gen_random_uuid() is built into Postgres 13 and later.

-- Who is acting. Every write runs inside a transaction that sets annam.account and annam.staff.
create or replace function annam_actor() returns text language sql stable as $$
  select nullif(current_setting('annam.account', true), '')
$$;
create or replace function annam_staff() returns text language sql stable as $$
  select nullif(current_setting('annam.staff', true), '')
$$;

create table accounts (
  username text primary key,
  role text not null check (role in ('clinic', 'nutritionist', 'admin')),
  display_name text not null,
  password_hash text not null,
  failed_attempts int not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table sessions (
  id text primary key,              -- sha-256 of the cookie token; the token itself is never stored
  username text not null references accounts(username) on delete cascade,
  staff_name text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz
);
create index on sessions (username);

create table patients (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null check (length(name) between 1 and 80),
  dob date not null,
  sex text not null check (sex in ('M', 'F')),
  referrer text not null check (length(referrer) between 1 and 80),
  programme text not null default '3-week one-to-one',
  start_date date,
  family_history text not null check (family_history in ('none', 'one', 'both')),
  triage jsonb not null default '[]',
  state text not null default 'consented' check (state in ('referred','consented','baseline_recorded','cleared','active','checkin_due','checkin_recorded','report_draft','report_approved','next_step','not_suitable','withdrawn','paused')),
  cleared_by_doctor text,
  cleared_by_lead text,
  is_sample boolean not null default false,
  created_at timestamptz not null default now()
);
create sequence patient_code_seq;

create table consents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  version text not null,
  recorded_by text not null,
  recorded_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  withdrawn_by text
);
create index on consents (patient_id);

create table visits (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  label text not null check (label in ('Baseline', 'Week 3 check-in', 'Week 12 follow-up', 'Other')),
  visit_date date not null,
  weight float8, height float8, waist float8, hip float8, sbp float8, dbp float8,
  fpg float8, ppg float8, hba1c float8, tc float8, ldl float8, hdl float8, tg float8,
  ast float8, alt float8, plt float8, creat float8,
  activity_minutes int check (activity_minutes between 0 and 3000),
  sleep_hours float8 check (sleep_hours between 0 and 24),
  tobacco text check (tobacco in ('never','quit_5y_plus','quit_1_5y','quit_under_1y','current')),
  secondhand_smoke boolean,
  idrs_activity text check (idrs_activity in ('vigorous','moderate','mild','sedentary')),
  on_bp_meds boolean, on_lipid_meds boolean, has_diabetes boolean,
  warnings_confirmed text[] not null default '{}',
  entered_by text not null,
  created_at timestamptz not null default now(),
  check (weight is not null or waist is not null or (sbp is not null and dbp is not null) or fpg is not null)
);
create index on visits (patient_id, visit_date);

create table plates (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  eaten_on date not null,
  eaten_at time not null,
  meal text not null check (meal in ('Breakfast', 'Lunch', 'Snack', 'Dinner')),
  photo bytea check (photo is null or octet_length(photo) <= 400000),
  photo_type text check (photo_type in ('image/jpeg')),
  tags jsonb not null default '{}',
  flags jsonb not null default '{}',
  score int check (score between 0 and 10),
  comment text check (length(comment) <= 300),
  uploaded_by text not null,
  reviewed_by text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check ((score is null) = (reviewed_at is null))
);
create index on plates (patient_id, eaten_on);

create table weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  week int not null check (week between 1 and 52),
  review text check (length(review) <= 1000),
  goals text check (length(goals) <= 500),
  checkin_attended boolean not null default false,
  author text not null,
  updated_at timestamptz not null default now(),
  unique (patient_id, week)
);

create table score_snapshots (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid not null unique references visits(id) on delete cascade,
  score_version text not null,
  score int,
  category text,
  measured int not null,
  components jsonb not null,
  idrs int, fib4 float8, egfr int, whtr float8, met_syn boolean,
  status text not null,
  reasons text[] not null default '{}',
  change_since_baseline int,
  change_since_previous int,
  created_at timestamptz not null default now()
);

create table alerts (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  visit_id uuid references visits(id) on delete cascade,
  flags text[] not null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by text,
  doctor_informed text
);

create table reports (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references patients(id) on delete cascade,
  version int not null,
  from_visit uuid references visits(id),
  to_visit uuid references visits(id),
  content jsonb not null,
  next_step text check (next_step in ('12-week programme', 'Condition track', 'Maintenance', 'Back to the referring doctor')),
  approved_by_doctor text,
  recorded_by text,
  approved_at timestamptz,
  locked boolean not null default false,
  created_by text not null,
  created_at timestamptz not null default now(),
  unique (patient_id, version),
  check (not locked or (approved_at is not null and approved_by_doctor is not null and next_step is not null))
);

create table audit_events (
  id int generated always as identity primary key,
  at timestamptz not null default now(),
  account text,
  staff_name text,
  action text not null,
  table_name text,
  row_id uuid,
  patient_id uuid,
  meta jsonb not null default '{}'
);
create index on audit_events (at);
create index on audit_events (patient_id, at);

-- Every write to clinical tables needs a named actor.
create or replace function annam_require_actor() returns trigger language plpgsql as $$
begin
  if annam_actor() is null then
    raise exception 'annam: no actor set for write to %', tg_table_name using errcode = 'P0001';
  end if;
  return coalesce(new, old);
end $$;

-- Audit every create, update and delete. Only column names are recorded, never values.
create or replace function annam_audit() returns trigger language plpgsql as $$
declare
  rec jsonb := to_jsonb(coalesce(new, old));
  changed text[];
begin
  if tg_op = 'UPDATE' then
    select array_agg(key order by key) into changed
      from jsonb_each(to_jsonb(new)) n
     where n.value is distinct from (to_jsonb(old) -> n.key);
  end if;
  insert into audit_events (account, staff_name, action, table_name, row_id, patient_id, meta)
  values (annam_actor(), annam_staff(), lower(tg_op), tg_table_name, (rec ->> 'id')::uuid,
          case when tg_table_name = 'patients' then (rec ->> 'id')::uuid else (rec ->> 'patient_id')::uuid end,
          case when changed is null then '{}'::jsonb else jsonb_build_object('columns', to_jsonb(changed)) end);
  return coalesce(new, old);
end $$;

-- No new clinical data without current consent.
create or replace function annam_require_consent() returns trigger language plpgsql as $$
begin
  if not exists (select 1 from consents c where c.patient_id = new.patient_id and c.withdrawn_at is null)
     or exists (select 1 from patients p where p.id = new.patient_id and p.state = 'withdrawn') then
    raise exception 'annam: consent is missing or withdrawn' using errcode = 'P0002';
  end if;
  return new;
end $$;

-- Approved reports never change.
create or replace function annam_report_lock() returns trigger language plpgsql as $$
begin
  -- The retention job (and only it) may delete approved reports once the retention period ends.
  if old.locked and not (tg_op = 'DELETE' and current_setting('annam.retention', true) = 'on') then
    raise exception 'annam: approved reports cannot be changed' using errcode = 'P0003';
  end if;
  return coalesce(new, old);
end $$;

-- The audit log is append-only.
create or replace function annam_audit_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'annam: the audit log cannot be changed' using errcode = 'P0004';
end $$;

do $$
declare t text;
begin
  foreach t in array array['patients','consents','visits','plates','weekly_reviews','score_snapshots','alerts','reports'] loop
    execute format('create trigger %I_actor before insert or update or delete on %I for each row execute function annam_require_actor()', t, t);
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function annam_audit()', t, t);
  end loop;
  foreach t in array array['visits','plates','weekly_reviews'] loop
    execute format('create trigger %I_consent before insert on %I for each row execute function annam_require_consent()', t, t);
  end loop;
end $$;

create trigger reports_lock before update or delete on reports for each row execute function annam_report_lock();
create trigger audit_append_only before update or delete on audit_events for each row execute function annam_audit_append_only();
`
  }
];
