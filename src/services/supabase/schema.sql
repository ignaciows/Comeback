-- Comeback — Supabase schema.
--
-- Not applied yet: the MVP persists locally through the storage port. This file
-- is the target the local shapes were designed against, so moving to Supabase is
-- an adapter change rather than a remodel.
--
-- Conventions:
--   · UUID primary keys, generated server-side.
--   · created_at / updated_at on every table.
--   · deleted_at where history must survive a delete (routines, sessions).
--   · Row Level Security on every table; a user only ever sees their own rows.
--   · Recorded, imported and calculated data are separate tables, and every
--     health value carries its source.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----

create type data_source as enum ('manual', 'apple_health', 'apple_watch', 'renpho', 'calculated');
create type goal_type as enum ('regain_condition', 'build_muscle', 'lose_fat', 'recomposition', 'build_strength', 'maintain');
create type experience_level as enum ('beginner', 'returning', 'intermediate', 'advanced');
create type training_location as enum ('gym', 'home');
create type unit_system as enum ('metric', 'imperial');
create type equipment_availability as enum ('available', 'unavailable', 'unsure');
create type planned_session_status as enum ('planned', 'completed', 'skipped', 'rescheduled', 'rest');
create type session_intent as enum ('full', 'reduced', 'recovery', 'free');
create type session_status as enum ('active', 'completed', 'discarded');
create type confidence_level as enum ('low', 'medium', 'high');
create type recommendation_type as enum ('full', 'reduced', 'recovery', 'rest', 'rescheduled', 'free');

-- ------------------------------------------------------------- profiles ----

create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  height_cm numeric(5,1) not null,
  experience experience_level not null,
  layoff_weeks integer not null default 0,
  limitations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create table user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  units unit_system not null default 'metric',
  default_rest_seconds integer not null default 120,
  week_starts_on smallint not null default 1,
  min_days_per_week integer not null default 3,
  preferred_days_per_week integer not null default 4,
  session_minutes integer not null default 60,
  preferred_weekdays smallint[] not null default '{1,2,4,5}',
  location training_location not null default 'gym',
  gym_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type goal_type not null,
  target_weight_kg numeric(5,2),
  protein_target_g integer,
  horizon_weeks integer not null default 16,
  started_at date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index goals_user_idx on goals (user_id) where deleted_at is null;

-- ------------------------------------------------- gyms and equipment ----

create table gyms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Catalogue table, shared by every user.
create table equipment (
  id text primary key,
  label text not null,
  category text not null
);

create table gym_equipment (
  gym_id uuid not null references gyms (id) on delete cascade,
  equipment_id text not null references equipment (id),
  availability equipment_availability not null default 'unsure',
  updated_at timestamptz not null default now(),
  primary key (gym_id, equipment_id)
);

-- --------------------------------------------------------- exercises ----

-- Canonical library, shared. `id` is language-independent; labels live in
-- exercise_labels so a locale can be added without touching logged data.
create table exercises (
  id text primary key,
  primary_muscle text not null,
  secondary_muscles text[] not null default '{}',
  pattern text not null,
  difficulty smallint not null default 1,
  is_compound boolean not null default false
);

create table exercise_labels (
  exercise_id text not null references exercises (id) on delete cascade,
  locale text not null,
  name text not null,
  primary key (exercise_id, locale)
);

create table exercise_equipment (
  exercise_id text not null references exercises (id) on delete cascade,
  equipment_id text not null references equipment (id),
  primary key (exercise_id, equipment_id)
);

create table exercise_alternatives (
  exercise_id text not null references exercises (id) on delete cascade,
  alternative_id text not null references exercises (id) on delete cascade,
  rank smallint not null default 0,
  primary key (exercise_id, alternative_id)
);

-- ----------------------------------------------------------- routines ----

create table routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  days_per_week integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index routines_user_idx on routines (user_id) where deleted_at is null;

create table routine_days (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references routines (id) on delete cascade,
  "order" integer not null,
  name text not null,
  focus text[] not null default '{}'
);
create index routine_days_routine_idx on routine_days (routine_id);

create table routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_day_id uuid not null references routine_days (id) on delete cascade,
  exercise_id text not null references exercises (id),
  "order" integer not null,
  sets integer not null,
  rep_min integer not null,
  rep_max integer not null,
  rest_seconds integer not null default 120
);
create index routine_exercises_day_idx on routine_exercises (routine_day_id);

-- ----------------------------------------------------------- sessions ----

create table planned_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  routine_id uuid references routines (id) on delete set null,
  routine_day_id uuid references routine_days (id) on delete set null,
  status planned_session_status not null default 'planned',
  session_id uuid,
  rescheduled_to_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index planned_sessions_user_date_idx on planned_sessions (user_id, date desc);

create table workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  started_at timestamptz not null,
  ended_at timestamptz,
  name text not null,
  routine_id uuid references routines (id) on delete set null,
  routine_day_id uuid references routine_days (id) on delete set null,
  planned_session_id uuid references planned_sessions (id) on delete set null,
  intent session_intent not null default 'full',
  status session_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index workout_sessions_user_date_idx on workout_sessions (user_id, date desc) where deleted_at is null;

create table workout_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references workout_sessions (id) on delete cascade,
  exercise_id text not null references exercises (id),
  "order" integer not null,
  substituted_from text references exercises (id),
  note text
);
create index workout_exercises_session_idx on workout_exercises (session_id);

create table workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_exercise_id uuid not null references workout_exercises (id) on delete cascade,
  "order" integer not null,
  weight_kg numeric(6,2),
  reps integer,
  rir smallint,
  warmup boolean not null default false,
  completed boolean not null default false,
  completed_at timestamptz
);
create index workout_sets_exercise_idx on workout_sets (workout_exercise_id);

-- --------------------------------------------------- recorded health ----

create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  sleep_hours numeric(4,2),
  sleep_quality smallint,
  energy smallint,
  soreness smallint,
  stress smallint,
  motivation smallint,
  source data_source not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create index daily_checkins_user_date_idx on daily_checkins (user_id, date desc);

create table body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  weight_kg numeric(5,2) not null,
  body_fat_percent numeric(4,1),
  source data_source not null default 'manual',
  created_at timestamptz not null default now(),
  unique (user_id, date, source)
);
create index body_measurements_user_date_idx on body_measurements (user_id, date desc);

-- Imported device data, kept separate from what the user typed.
create table health_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  metric text not null,
  value numeric not null,
  unit text not null,
  source data_source not null,
  created_at timestamptz not null default now(),
  unique (user_id, date, metric, source)
);
create index health_metrics_user_date_idx on health_metrics (user_id, date desc);

-- ------------------------------------------------ calculated outputs ----

create table momentum_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  score numeric(5,2) not null,
  previous_score numeric(5,2),
  delta numeric(5,2) not null default 0,
  state text not null,
  confidence confidence_level not null,
  adherence numeric(5,2),
  consistency numeric(5,2),
  progression numeric(5,2),
  recovery numeric(5,2),
  logging numeric(5,2),
  explanation text not null,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);
create index momentum_snapshots_user_date_idx on momentum_snapshots (user_id, date desc);

create table momentum_factors (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references momentum_snapshots (id) on delete cascade,
  key text not null,
  label text not null,
  direction text not null,
  detail text
);
create index momentum_factors_snapshot_idx on momentum_factors (snapshot_id);

create table comeback_baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'observed',
  established_at date not null,
  weekly_sessions numeric(4,2) not null default 0,
  weekly_volume_kg numeric(10,2) not null default 0,
  sample_sessions integer not null default 0,
  created_at timestamptz not null default now()
);

create table comeback_baseline_exercises (
  baseline_id uuid not null references comeback_baselines (id) on delete cascade,
  exercise_id text not null references exercises (id),
  e1rm_kg numeric(6,2) not null,
  primary key (baseline_id, exercise_id)
);

create table comeback_progress_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  value numeric(5,2),
  confidence confidence_level not null,
  strength numeric(5,2),
  volume numeric(5,2),
  frequency numeric(5,2),
  matched_exercises integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table daily_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  type recommendation_type not null,
  title text not null,
  routine_id uuid references routines (id) on delete set null,
  routine_day_id uuid references routine_days (id) on delete set null,
  estimated_minutes integer not null default 0,
  reason text not null,
  factors jsonb not null default '[]',
  confidence confidence_level not null,
  followed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

-- ------------------------------------------------------------- policies ----

alter table profiles enable row level security;
alter table user_preferences enable row level security;
alter table goals enable row level security;
alter table gyms enable row level security;
alter table gym_equipment enable row level security;
alter table routines enable row level security;
alter table routine_days enable row level security;
alter table routine_exercises enable row level security;
alter table planned_sessions enable row level security;
alter table workout_sessions enable row level security;
alter table workout_exercises enable row level security;
alter table workout_sets enable row level security;
alter table daily_checkins enable row level security;
alter table body_measurements enable row level security;
alter table health_metrics enable row level security;
alter table momentum_snapshots enable row level security;
alter table momentum_factors enable row level security;
alter table comeback_baselines enable row level security;
alter table comeback_baseline_exercises enable row level security;
alter table comeback_progress_snapshots enable row level security;
alter table daily_recommendations enable row level security;

-- Tables that carry user_id directly.
do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'user_preferences', 'goals', 'gyms', 'routines', 'planned_sessions',
    'workout_sessions', 'daily_checkins', 'body_measurements', 'health_metrics',
    'momentum_snapshots', 'comeback_baselines', 'comeback_progress_snapshots',
    'daily_recommendations'
  ]
  loop
    execute format(
      'create policy %I on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())',
      target || '_owner', target
    );
  end loop;
end $$;

-- Child tables inherit ownership through their parent.
create policy routine_days_owner on routine_days for all
  using (exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid()))
  with check (exists (select 1 from routines r where r.id = routine_id and r.user_id = auth.uid()));

create policy routine_exercises_owner on routine_exercises for all
  using (exists (
    select 1 from routine_days d join routines r on r.id = d.routine_id
    where d.id = routine_day_id and r.user_id = auth.uid()))
  with check (exists (
    select 1 from routine_days d join routines r on r.id = d.routine_id
    where d.id = routine_day_id and r.user_id = auth.uid()));

create policy workout_exercises_owner on workout_exercises for all
  using (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from workout_sessions s where s.id = session_id and s.user_id = auth.uid()));

create policy workout_sets_owner on workout_sets for all
  using (exists (
    select 1 from workout_exercises e join workout_sessions s on s.id = e.session_id
    where e.id = workout_exercise_id and s.user_id = auth.uid()))
  with check (exists (
    select 1 from workout_exercises e join workout_sessions s on s.id = e.session_id
    where e.id = workout_exercise_id and s.user_id = auth.uid()));

create policy gym_equipment_owner on gym_equipment for all
  using (exists (select 1 from gyms g where g.id = gym_id and g.user_id = auth.uid()))
  with check (exists (select 1 from gyms g where g.id = gym_id and g.user_id = auth.uid()));

create policy momentum_factors_owner on momentum_factors for all
  using (exists (select 1 from momentum_snapshots s where s.id = snapshot_id and s.user_id = auth.uid()))
  with check (exists (select 1 from momentum_snapshots s where s.id = snapshot_id and s.user_id = auth.uid()));

create policy comeback_baseline_exercises_owner on comeback_baseline_exercises for all
  using (exists (select 1 from comeback_baselines b where b.id = baseline_id and b.user_id = auth.uid()))
  with check (exists (select 1 from comeback_baselines b where b.id = baseline_id and b.user_id = auth.uid()));

-- Catalogue tables are readable by any authenticated user and written only by
-- the service role.
alter table exercises enable row level security;
alter table exercise_labels enable row level security;
alter table exercise_equipment enable row level security;
alter table exercise_alternatives enable row level security;
alter table equipment enable row level security;

create policy exercises_read on exercises for select using (auth.role() = 'authenticated');
create policy exercise_labels_read on exercise_labels for select using (auth.role() = 'authenticated');
create policy exercise_equipment_read on exercise_equipment for select using (auth.role() = 'authenticated');
create policy exercise_alternatives_read on exercise_alternatives for select using (auth.role() = 'authenticated');
create policy equipment_read on equipment for select using (auth.role() = 'authenticated');
