-- =============================================================================
-- ALUBALI — Datenbankschema (Entwurf)
-- PostgreSQL 15+ / Supabase
--
-- STATUS: Architektur-Entwurf. Wird bei der Implementierung in nummerierte
--         Migrationen unter supabase/migrations/ aufgeteilt.
--
-- Konventionen:
--   * Jede Business-Tabelle hat org_id -> Mandantengrenze und RLS-Anker
--   * snake_case, Plural für Tabellen
--   * timestamptz überall, niemals timestamp
--   * Soft Delete via deleted_at, Hard Delete via Cron (siehe Abschnitt 9)
--   * Enums für stabile Wertemengen, Katalogtabellen für wachsende
-- =============================================================================


-- =============================================================================
-- 1. ERWEITERUNGEN
-- =============================================================================

create extension if not exists "pgcrypto";     -- gen_random_uuid()
create extension if not exists "pg_trgm";      -- Namenssuche, skriptunabhängig
create extension if not exists "btree_gist";   -- Ausschluss-Constraints auf daterange

create schema if not exists app;               -- Helper-Funktionen, nicht via API exponiert


-- =============================================================================
-- 2. ENUMS
-- =============================================================================

create type org_role as enum ('owner', 'staff', 'caregiver', 'family');

create type caregiver_status as enum (
  'new',          -- gerade erfasst
  'incomplete',   -- zu wenig Daten für Vermittlung
  'available',    -- vermittelbar
  'proposed',     -- irgendwo vorgeschlagen
  'committed',    -- hat zugesagt, noch nicht gestartet
  'placed',       -- im Einsatz
  'paused',       -- vorübergehend nicht verfügbar
  'archived'
);

create type case_status as enum (
  'new',
  'needs_clarified',   -- Bedarf aufgenommen
  'searching',         -- Kandidatinnen werden gesucht
  'proposed',          -- Kandidatinnen vorgeschlagen
  'interview',         -- Gespräch läuft
  'confirmed',         -- Zusage
  'active',            -- Einsatz läuft
  'completed',
  'lost'               -- Familie abgesprungen
);

create type placement_status as enum (
  'proposed', 'accepted', 'declined', 'active', 'ended', 'cancelled'
);

create type mobility_level as enum ('mobile', 'limited', 'wheelchair', 'bedridden');
create type dementia_level as enum ('none', 'mild', 'moderate', 'severe');
create type living_situation as enum ('alone', 'with_partner', 'with_family', 'facility');

create type document_kind as enum (
  'id', 'passport', 'cv', 'reference', 'certificate', 'insurance',
  'contract', 'a1_certificate', 'photo', 'other'
);

-- Polymorphe Anhänge (documents / notes / communications)
create type entity_kind as enum ('caregiver', 'family', 'care_case', 'placement');

create type task_status as enum ('open', 'done', 'snoozed', 'cancelled');
create type task_source as enum ('manual', 'assistant', 'system');

create type comm_channel   as enum ('whatsapp', 'email', 'phone', 'inapp', 'other');
create type comm_direction as enum ('outbound', 'inbound');
create type comm_state     as enum ('draft', 'sent', 'received', 'archived');

create type personal_category as enum (
  'restaurant', 'jewelry', 'beauty', 'series', 'place', 'gift', 'trip', 'other'
);

create type ai_task_kind as enum (
  'transcribe', 'route', 'extract', 'explain_document',
  'draft_message', 'translate', 'search_filter', 'answer'
);

create type draft_state as enum ('pending', 'confirmed', 'discarded', 'expired');


-- =============================================================================
-- 3. IDENTITÄT & MANDANT
-- =============================================================================

create table profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_path  text,
  locale       text not null default 'ka' check (locale in ('ka', 'de', 'en')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table organization_members (
  org_id    uuid not null references organizations(id) on delete cascade,
  user_id   uuid not null references profiles(id)      on delete cascade,
  role      org_role not null default 'owner',
  joined_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index on organization_members (user_id);


-- -----------------------------------------------------------------------------
-- Helper: Mandanten- und Rollenauflösung
-- security definer, damit die Policies nicht rekursiv gegen sich selbst laufen
-- -----------------------------------------------------------------------------

create or replace function app.current_org_ids()
returns setof uuid
language sql stable security definer
set search_path = public, pg_temp
as $$
  select org_id from organization_members where user_id = (select auth.uid());
$$;

create or replace function app.has_role(p_org uuid, p_roles org_role[])
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from organization_members
    where org_id = p_org
      and user_id = (select auth.uid())
      and role = any(p_roles)
  );
$$;

-- HINWEIS zur Performance:
-- In allen Policies wird auth.uid() als (select auth.uid()) geschrieben.
-- Damit wertet Postgres es einmal als InitPlan aus statt pro Zeile.


-- =============================================================================
-- 4. KATALOGE (geteilt, nicht mandantenspezifisch)
-- =============================================================================

create table skills (
  key         text primary key,             -- 'dementia', 'bedridden', 'catheter', ...
  category    text not null,                -- 'care' | 'household' | 'medical' | 'social'
  label_ka    text not null,
  label_de    text not null,
  sort_order  smallint not null default 100
);

create table care_tasks (
  key         text primary key,             -- 'cooking', 'shopping', 'laundry', ...
  category    text not null,
  label_ka    text not null,
  label_de    text not null,
  sort_order  smallint not null default 100
);

-- Kataloge sind für alle authentifizierten Nutzer lesbar, aber nicht schreibbar.


-- =============================================================================
-- 5. BUSINESS: PFLEGERINNEN
-- =============================================================================

create table caregivers (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,

  first_name       text not null,
  last_name        text,
  birth_year       smallint check (birth_year between 1930 and extract(year from now())::int - 18),
  nationality      text not null default 'GE',   -- ISO 3166-1 alpha-2

  phone            text,
  whatsapp         text,
  email            text,
  home_city        text,
  home_country     text not null default 'GE',

  -- 0 = keine, 1 = A1, 2 = A2, 3 = B1, 4 = B2, 5 = C1, 6 = C2
  german_level     smallint check (german_level between 0 and 6),

  experience_years smallint check (experience_years between 0 and 60),
  driver_license   boolean,
  smoker           boolean,
  night_work       boolean,
  cooking          boolean,
  has_passport     boolean,

  available_from      date,
  rotation_weeks      smallint check (rotation_weeks between 1 and 52),
  desired_salary_eur  numeric(8,2) check (desired_salary_eur >= 0),

  status           caregiver_status not null default 'new',
  photo_path       text,
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references profiles(id),
  deleted_at       timestamptz
);

create index on caregivers (org_id, status) where deleted_at is null;
create index on caregivers (org_id, available_from) where deleted_at is null;
create index caregivers_name_trgm on caregivers
  using gin ((coalesce(first_name,'') || ' ' || coalesce(last_name,'')) gin_trgm_ops);

-- Sprachen -------------------------------------------------------------------
create table caregiver_languages (
  caregiver_id uuid not null references caregivers(id) on delete cascade,
  lang         text not null check (char_length(lang) = 2),   -- 'ka','de','ru','en','tr'
  level        smallint not null check (level between 0 and 6),
  primary key (caregiver_id, lang)
);

-- Fachkenntnisse -------------------------------------------------------------
create table caregiver_skills (
  caregiver_id uuid not null references caregivers(id) on delete cascade,
  skill_key    text not null references skills(key),
  years        smallint check (years between 0 and 60),
  primary key (caregiver_id, skill_key)
);

create index on caregiver_skills (skill_key);

-- Verfügbarkeit --------------------------------------------------------------
-- daterange mit Ausschluss-Constraint: überlappende Verfügbarkeiten derselben
-- Art sind datenbankseitig unmöglich. Keine Anwendungslogik nötig.
create table caregiver_availability (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  caregiver_id uuid not null references caregivers(id)    on delete cascade,
  period       daterange not null,
  kind         text not null default 'available' check (kind in ('available','blocked')),
  note         text,
  created_at   timestamptz not null default now(),

  constraint caregiver_availability_no_overlap
    exclude using gist (caregiver_id with =, kind with =, period with &&)
);

create index on caregiver_availability using gist (period);
create index on caregiver_availability (caregiver_id);


-- =============================================================================
-- 6. BUSINESS: FAMILIEN & PFLEGEFÄLLE
-- =============================================================================

-- Die Familie ist die Kontakt- und Vertragspartei, NICHT die pflegebedürftige
-- Person. Eine Familie kann mehrere Fälle haben (z.B. beide Elternteile).
create table families (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organizations(id) on delete cascade,

  contact_name      text not null,
  relation          text,                  -- 'Tochter', 'Sohn', 'Ehepartner'
  phone             text,
  email             text,
  city              text,
  postal_code       text,
  street            text,                  -- nur wenn tatsächlich benötigt
  source            text,                  -- 'empfehlung', 'anzeige', ...

  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references profiles(id),
  deleted_at        timestamptz
);

create index on families (org_id) where deleted_at is null;
create index families_name_trgm on families using gin (contact_name gin_trgm_ops);

-- Der Pflegefall: die betreute Person + Einsatzanforderungen.
-- case_requirements wurde bewusst hier eingefaltet (siehe ARCHITECTURE.md K5).
create table care_cases (
  id                       uuid primary key default gen_random_uuid(),
  org_id                   uuid not null references organizations(id) on delete cascade,
  family_id                uuid not null references families(id)      on delete cascade,

  -- Betreute Person (minimal gehalten)
  patient_first_name       text,
  patient_birth_year       smallint check (patient_birth_year between 1900 and extract(year from now())::int),
  patient_gender           text check (patient_gender in ('f','m','d')),

  -- Operativ nötige Gesundheitsmerkmale (grob; Details -> care_case_health)
  care_level               smallint check (care_level between 0 and 5),   -- Pflegegrad
  mobility                 mobility_level,
  dementia                 dementia_level,

  -- Wohn- und Einsatzsituation
  living_situation         living_situation,
  household_size           smallint check (household_size between 1 and 12),
  has_pets                 boolean,
  own_room                 boolean,
  internet_available       boolean,

  -- Anforderungen
  night_work_required      boolean not null default false,
  driver_license_required  boolean not null default false,
  car_provided             boolean,
  smoking_allowed          boolean not null default false,
  required_german_level    smallint check (required_german_level between 0 and 6),

  -- Präferenzen (WEICH, nie harte Filter -- siehe ARCHITECTURE.md K11)
  preferred_gender         text check (preferred_gender in ('f','m','any')),
  preference_note          text,

  -- Einsatzrahmen
  start_date               date,
  expected_months          smallint check (expected_months between 1 and 120),
  budget_eur               numeric(8,2) check (budget_eur >= 0),

  status                   case_status not null default 'new',
  notes                    text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now(),
  created_by               uuid references profiles(id),
  deleted_at               timestamptz
);

create index on care_cases (org_id, status)     where deleted_at is null;
create index on care_cases (org_id, start_date) where deleted_at is null;
create index on care_cases (family_id);

-- -----------------------------------------------------------------------------
-- Art. 9 DSGVO: Gesundheitsdaten im Freitext.
-- Eigene Tabelle -> eigene Policy, eigene Retention, KEINE Audit-Wertdiffs,
-- und später nachrüstbare Spaltenverschlüsselung ohne Refactoring.
-- -----------------------------------------------------------------------------
create table care_case_health (
  care_case_id       uuid primary key references care_cases(id) on delete cascade,
  org_id             uuid not null references organizations(id) on delete cascade,

  diagnoses          text,
  medication         text,
  mobility_details   text,
  incontinence       boolean,
  special_care_notes text,

  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- Aufgaben des Einsatzes -----------------------------------------------------
create table care_case_tasks (
  care_case_id uuid not null references care_cases(id) on delete cascade,
  task_key     text not null references care_tasks(key),
  importance   smallint not null default 2 check (importance between 1 and 3),
  primary key (care_case_id, task_key)
);


-- =============================================================================
-- 7. BUSINESS: EINSÄTZE
-- =============================================================================

-- Ein "Match" ist keine eigene Entity (siehe ARCHITECTURE.md K4).
-- Scores werden on-the-fly berechnet; erst der VORSCHLAG wird persistiert --
-- und der ist bereits ein placement mit Status 'proposed'.
create table placements (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references organizations(id) on delete cascade,
  caregiver_id     uuid not null references caregivers(id)    on delete restrict,
  care_case_id     uuid not null references care_cases(id)    on delete restrict,

  status           placement_status not null default 'proposed',

  -- Score zum Zeitpunkt des Vorschlags eingefroren (Nachvollziehbarkeit)
  score            smallint check (score between 0 and 100),
  score_confidence smallint check (score_confidence between 0 and 100),
  score_breakdown  jsonb,          -- { availability: 22, skills: 25, ... }
  match_reasons    jsonb,          -- [{ key, params, polarity }] -> i18n, kein AI

  proposed_at      timestamptz,
  accepted_at      timestamptz,
  declined_reason  text,
  start_date       date,
  end_date         date,

  compensation_eur numeric(8,2) check (compensation_eur >= 0),
  commission_eur   numeric(8,2) check (commission_eur   >= 0),
  notes            text,

  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references profiles(id),

  constraint placements_dates_ordered
    check (end_date is null or start_date is null or end_date >= start_date)
);

create index on placements (org_id, status);
create index on placements (care_case_id, status);
create index on placements (caregiver_id, status);

-- Eine Pflegerin kann nicht zweimal gleichzeitig im Einsatz sein.
-- Datenbankseitig erzwungen, kein Race Condition möglich.
create index placements_active_period on placements
  using gist (caregiver_id, daterange(start_date, end_date, '[]'))
  where status in ('accepted', 'active');

alter table placements add constraint placements_no_overlap
  exclude using gist (
    caregiver_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('accepted', 'active') and start_date is not null);


-- =============================================================================
-- 8. ANHÄNGE (polymorph)
-- =============================================================================

create table documents (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,

  owner_kind   entity_kind not null,
  owner_id     uuid not null,

  kind         document_kind not null default 'other',
  storage_path text not null unique,
  file_name    text not null,
  mime_type    text not null,
  size_bytes   bigint not null check (size_bytes > 0),
  expires_at   date,                        -- Pass, A1, Versicherung -> Warnung

  uploaded_by  uuid references profiles(id),
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index on documents (org_id, owner_kind, owner_id) where deleted_at is null;
create index on documents (org_id, expires_at) where expires_at is not null and deleted_at is null;

create table notes (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  owner_kind  entity_kind,                  -- NULL = freistehende Notiz
  owner_id    uuid,
  body        text not null,
  body_lang   text not null default 'ka',
  source      task_source not null default 'manual',
  recording_id uuid,                        -- FK weiter unten
  created_at  timestamptz not null default now(),
  created_by  uuid references profiles(id),
  deleted_at  timestamptz,

  constraint notes_owner_complete
    check ((owner_kind is null) = (owner_id is null))
);

create index on notes (org_id, owner_kind, owner_id) where deleted_at is null;
create index on notes (org_id, created_at desc);

create table communications (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,
  owner_kind   entity_kind not null,
  owner_id     uuid not null,

  channel      comm_channel not null,
  direction    comm_direction not null,
  state        comm_state not null default 'draft',

  subject      text,
  body_de      text,
  body_ka      text,                        -- Rückübersetzung, immer mitgespeichert
  variant      text,                        -- 'friendly'|'business'|'formal'|'short'

  generated_by_ai boolean not null default false,
  sent_at      timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid references profiles(id)
);

create index on communications (org_id, owner_kind, owner_id, created_at desc);


-- =============================================================================
-- 9. AUFGABEN & PERSÖNLICHES
-- =============================================================================

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references organizations(id) on delete cascade,

  title        text not null,
  title_lang   text not null default 'ka',
  detail       text,
  due_at       timestamptz,
  status       task_status not null default 'open',
  source       task_source not null default 'manual',

  related_kind entity_kind,
  related_id   uuid,

  created_at   timestamptz not null default now(),
  created_by   uuid references profiles(id),
  done_at      timestamptz
);

create index on tasks (org_id, status, due_at);
create index on tasks (org_id, related_kind, related_id);

create table personal_items (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references profiles(id)      on delete cascade,

  category    personal_category not null,
  title       text not null,
  note        text,
  url         text,
  image_path  text,
  price_eur   numeric(10,2),
  is_favorite boolean not null default false,
  is_done     boolean not null default false,
  is_locked   boolean not null default false,   -- Easter Egg: nicht löschbar
  position    integer not null default 0,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);

create index on personal_items (user_id, category, position) where deleted_at is null;


-- =============================================================================
-- 10. ASSISTENT (getrennt von Businessdaten, kurze Retention)
-- =============================================================================

create table voice_recordings (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid not null references profiles(id)      on delete cascade,

  storage_path  text,                      -- wird nach Retention geleert
  duration_sec  numeric(6,2),
  language      text,
  transcript    text,                      -- bleibt erhalten
  confidence    numeric(4,3),
  provider      text,

  created_at    timestamptz not null default now(),
  audio_purge_at timestamptz not null default (now() + interval '30 days')
);

create index on voice_recordings (org_id, created_at desc);
create index on voice_recordings (audio_purge_at) where storage_path is not null;

alter table notes
  add constraint notes_recording_fk
  foreign key (recording_id) references voice_recordings(id) on delete set null;

-- Der Draft ist der Kern der Human-in-the-Loop-Architektur:
-- Die AI schreibt HIER hinein, niemals direkt in Businesstabellen.
create table assistant_drafts (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid not null references profiles(id)      on delete cascade,

  tool_name     text not null,
  payload       jsonb not null,            -- Zod-validierte Tool-Argumente
  uncertain_fields text[] not null default '{}',
  missing_fields   text[] not null default '{}',

  recording_id  uuid references voice_recordings(id) on delete set null,
  state         draft_state not null default 'pending',
  result_kind   entity_kind,
  result_id     uuid,                      -- gefüllt NACH Bestätigung

  created_at    timestamptz not null default now(),
  resolved_at   timestamptz,
  expires_at    timestamptz not null default (now() + interval '24 hours')
);

create index on assistant_drafts (user_id, state, created_at desc);
create index on assistant_drafts (expires_at) where state = 'pending';

-- Entity-Context-Stack statt Chatverlauf (siehe ARCHITECTURE.md F.3)
create table assistant_sessions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid not null references profiles(id)      on delete cascade,
  context_stack jsonb not null default '[]'::jsonb,   -- max. 10 Einträge, LRU
  last_active_at timestamptz not null default now(),
  expires_at    timestamptz not null default (now() + interval '30 days')
);

create index on assistant_sessions (user_id, last_active_at desc);

-- Telemetrie OHNE Inhalte. Nur Zahlen.
create table ai_interactions (
  id            bigserial primary key,
  org_id        uuid not null references organizations(id) on delete cascade,
  user_id       uuid references profiles(id) on delete set null,

  kind          ai_task_kind not null,
  provider      text not null,
  model         text not null,
  tier          text,

  input_tokens  integer,
  output_tokens integer,
  audio_seconds numeric(8,2),
  cost_usd      numeric(10,6),
  latency_ms    integer,

  tool_name     text,
  cache_hit     boolean not null default false,
  success       boolean not null default true,
  error_code    text,

  created_at    timestamptz not null default now()
);

create index on ai_interactions (org_id, created_at desc);
create index on ai_interactions (org_id, date_trunc('month', created_at));

-- Cache für Übersetzungen und Dokumenterklärungen
create table ai_cache (
  cache_key  text primary key,             -- sha256(task + input + params)
  kind       ai_task_kind not null,
  result     jsonb not null,
  hits       integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days')
);

create index on ai_cache (expires_at);


-- =============================================================================
-- 11. INFRASTRUKTUR: EVENTS, NOTIFICATIONS, AUDIT, SETTINGS
-- =============================================================================

-- Outbox-Pattern: Event wird in derselben Transaktion wie die Änderung
-- geschrieben. Ein Cron-Drainer verarbeitet sie. Kein Queue-Dienst nötig.
create table domain_events (
  id           bigserial primary key,
  org_id       uuid not null references organizations(id) on delete cascade,
  type         text not null,              -- 'CaregiverCreated', 'PlacementStarted', ...
  payload      jsonb not null default '{}'::jsonb,
  occurred_at  timestamptz not null default now(),
  processed_at timestamptz,
  attempts     smallint not null default 0,
  last_error   text
);

create index domain_events_unprocessed on domain_events (occurred_at)
  where processed_at is null;

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references profiles(id)      on delete cascade,

  type       text not null,
  title      text not null,
  body       text,
  data       jsonb not null default '{}'::jsonb,
  channels   text[] not null default '{inapp}',

  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index on notifications (user_id, read_at, created_at desc);

create table audit_logs (
  id             bigserial primary key,
  org_id         uuid not null,
  actor_id       uuid,
  table_name     text not null,
  row_id         uuid not null,
  op             text not null check (op in ('INSERT','UPDATE','DELETE')),
  changed_fields jsonb,          -- { spalte: [alt, neu] }; bei Art.-9-Tabellen nur Spaltennamen
  at             timestamptz not null default now()
);

create index on audit_logs (org_id, table_name, row_id, at desc);
create index on audit_logs (org_id, at desc);

create table app_settings (
  org_id     uuid not null references organizations(id) on delete cascade,
  key        text not null,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (org_id, key)
);


-- =============================================================================
-- 12. TRIGGER
-- =============================================================================

-- updated_at automatisch --------------------------------------------------
create or replace function app.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','organizations','caregivers','families','care_cases',
    'care_case_health','placements','personal_items'
  ] loop
    execute format(
      'create trigger %I_touch before update on %I
       for each row execute function app.touch_updated_at()', t, t);
  end loop;
end $$;


-- Audit Log ----------------------------------------------------------------
-- Tabellen in REDACTED_TABLES loggen nur Spaltennamen, keine Werte (Art. 9).
create or replace function app.audit_change()
returns trigger language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_changed  jsonb := '{}'::jsonb;
  v_redacted boolean := tg_table_name = any (array['care_case_health']);
  v_row_id   uuid;
  v_org_id   uuid;
  k          text;
begin
  if tg_op = 'DELETE' then
    v_row_id := (to_jsonb(old)->>'id')::uuid;
    v_org_id := (to_jsonb(old)->>'org_id')::uuid;
  else
    v_row_id := (to_jsonb(new)->>'id')::uuid;
    v_org_id := (to_jsonb(new)->>'org_id')::uuid;
  end if;

  if tg_op = 'UPDATE' then
    for k in select jsonb_object_keys(to_jsonb(new)) loop
      if to_jsonb(new)->k is distinct from to_jsonb(old)->k
         and k not in ('updated_at') then
        if v_redacted then
          v_changed := v_changed || jsonb_build_object(k, '[redacted]');
        else
          v_changed := v_changed || jsonb_build_object(
            k, jsonb_build_array(to_jsonb(old)->k, to_jsonb(new)->k));
        end if;
      end if;
    end loop;
    if v_changed = '{}'::jsonb then
      return null;   -- nichts Relevantes geändert
    end if;
  end if;

  insert into audit_logs (org_id, actor_id, table_name, row_id, op, changed_fields)
  values (v_org_id, (select auth.uid()), tg_table_name, v_row_id, tg_op, v_changed);

  return null;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'caregivers','families','care_cases','care_case_health','placements',
    'documents','caregiver_availability'
  ] loop
    execute format(
      'create trigger %I_audit after insert or update or delete on %I
       for each row execute function app.audit_change()', t, t);
  end loop;
end $$;


-- Domain Events aus Statusübergängen ---------------------------------------
create or replace function app.emit_placement_events()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into domain_events (org_id, type, payload)
    values (new.org_id, 'PlacementProposed',
            jsonb_build_object('placementId', new.id,
                               'caregiverId', new.caregiver_id,
                               'careCaseId',  new.care_case_id));
  elsif new.status is distinct from old.status then
    insert into domain_events (org_id, type, payload)
    values (new.org_id,
            case new.status
              when 'accepted' then 'PlacementAccepted'
              when 'active'   then 'PlacementStarted'
              when 'ended'    then 'PlacementEnded'
              when 'declined' then 'PlacementDeclined'
              else 'PlacementStatusChanged'
            end,
            jsonb_build_object('placementId', new.id, 'status', new.status));
  end if;
  return null;
end $$;

create trigger placements_events
  after insert or update on placements
  for each row execute function app.emit_placement_events();


-- =============================================================================
-- 13. ROW LEVEL SECURITY
-- =============================================================================

-- Ein Muster für alle mandantengebundenen Tabellen.
-- Wird bei der Implementierung generiert, hier zur Illustration ausgeschrieben.

alter table profiles              enable row level security;
alter table organizations         enable row level security;
alter table organization_members  enable row level security;
alter table caregivers            enable row level security;
alter table caregiver_languages   enable row level security;
alter table caregiver_skills      enable row level security;
alter table caregiver_availability enable row level security;
alter table families              enable row level security;
alter table care_cases            enable row level security;
alter table care_case_health      enable row level security;
alter table care_case_tasks       enable row level security;
alter table placements            enable row level security;
alter table documents             enable row level security;
alter table notes                 enable row level security;
alter table communications        enable row level security;
alter table tasks                 enable row level security;
alter table personal_items        enable row level security;
alter table voice_recordings      enable row level security;
alter table assistant_drafts      enable row level security;
alter table assistant_sessions    enable row level security;
alter table ai_interactions       enable row level security;
alter table notifications         enable row level security;
alter table audit_logs            enable row level security;
alter table app_settings          enable row level security;
alter table domain_events         enable row level security;
alter table skills                enable row level security;
alter table care_tasks            enable row level security;
alter table ai_cache              enable row level security;

-- Eigenes Profil --------------------------------------------------------------
create policy profiles_self on profiles
  for all using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Organisation ----------------------------------------------------------------
create policy organizations_member_read on organizations
  for select using (id in (select app.current_org_ids()));

create policy organizations_owner_write on organizations
  for update using (app.has_role(id, array['owner']::org_role[]))
           with check (app.has_role(id, array['owner']::org_role[]));

create policy org_members_read on organization_members
  for select using (org_id in (select app.current_org_ids()));

create policy org_members_owner_write on organization_members
  for all using (app.has_role(org_id, array['owner']::org_role[]))
         with check (app.has_role(org_id, array['owner']::org_role[]));

-- Standardmuster: Business-Tabellen -------------------------------------------
-- SELECT für alle Mitglieder der Org, Schreiben für owner+staff.
create policy caregivers_read on caregivers
  for select using (org_id in (select app.current_org_ids()));

create policy caregivers_write on caregivers
  for all using (org_id in (select app.current_org_ids())
                 and app.has_role(org_id, array['owner','staff']::org_role[]))
         with check (org_id in (select app.current_org_ids())
                 and app.has_role(org_id, array['owner','staff']::org_role[]));

-- ... identisch für: families, care_cases, care_case_tasks, placements,
--     documents, notes, communications, tasks, voice_recordings,
--     caregiver_languages*, caregiver_skills*, caregiver_availability
--     (* über den caregiver_id-Join auf die Org auflösen)

create policy caregiver_languages_all on caregiver_languages
  for all using (exists (select 1 from caregivers c
                         where c.id = caregiver_id
                           and c.org_id in (select app.current_org_ids())))
         with check (exists (select 1 from caregivers c
                         where c.id = caregiver_id
                           and c.org_id in (select app.current_org_ids())));

-- Art. 9: strenger. Nur owner. -------------------------------------------------
create policy care_case_health_owner_only on care_case_health
  for all using (app.has_role(org_id, array['owner']::org_role[]))
         with check (app.has_role(org_id, array['owner']::org_role[]));

-- Persönlicher Bereich: nur der Nutzer selbst, auch nicht andere Org-Mitglieder
create policy personal_items_self on personal_items
  for all using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()));

-- Assistent: nur eigene Drafts/Sessions
create policy assistant_drafts_self on assistant_drafts
  for all using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()));

create policy assistant_sessions_self on assistant_sessions
  for all using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()));

create policy notifications_self on notifications
  for all using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()));

-- Nur lesbar: Audit, Telemetrie -----------------------------------------------
create policy audit_logs_read on audit_logs
  for select using (org_id in (select app.current_org_ids())
                    and app.has_role(org_id, array['owner']::org_role[]));

create policy ai_interactions_read on ai_interactions
  for select using (org_id in (select app.current_org_ids()));

-- Kataloge: für alle Eingeloggten lesbar, nie schreibbar ----------------------
create policy skills_read     on skills     for select to authenticated using (true);
create policy care_tasks_read on care_tasks for select to authenticated using (true);

-- ai_cache und domain_events: KEINE Policy -> nur Service Role kommt heran.
-- Das ist Absicht.


-- =============================================================================
-- 14. STORAGE POLICIES
-- =============================================================================
-- Bucket 'documents' privat anlegen. Pfad: {org_id}/{owner_kind}/{owner_id}/{uuid}
-- Der erste Pfadabschnitt ist die Org -- darauf greift die Policy.

-- insert into storage.buckets (id, name, public) values ('documents','documents',false);

-- create policy documents_org_read on storage.objects for select
--   using (bucket_id = 'documents'
--          and ((storage.foldername(name))[1])::uuid in (select app.current_org_ids()));
--
-- create policy documents_org_write on storage.objects for insert
--   with check (bucket_id = 'documents'
--          and ((storage.foldername(name))[1])::uuid in (select app.current_org_ids()));

-- Signed URLs werden AUSSCHLIESSLICH serverseitig mit 60s TTL erzeugt.
-- Es gibt keinen öffentlichen Zugriffspfad auf diesen Bucket.


-- =============================================================================
-- 15. RETENTION / LÖSCHKONZEPT  (Cron via pg_cron oder Vercel Cron)
-- =============================================================================
--
--  täglich:
--    * Audio löschen:      voice_recordings where audio_purge_at < now()
--                          -> Storage-Objekt entfernen, storage_path = null
--    * Drafts:             assistant_drafts where expires_at < now() and state='pending'
--                          -> state = 'expired', nach 7 weiteren Tagen DELETE
--    * Sessions:           assistant_sessions where expires_at < now()  -> DELETE
--    * Cache:              ai_cache where expires_at < now()            -> DELETE
--    * Papierkorb:         alle Tabellen where deleted_at < now() - 30d -> HARD DELETE
--                          inkl. zugehöriger Storage-Objekte
--
--  monatlich:
--    * ai_interactions   älter als 12 Monate  -> DELETE
--    * audit_logs        älter als 24 Monate  -> DELETE
--    * domain_events     processed_at < now() - 90d -> DELETE
--
--  Vollständige Kontolöschung: eine Transaktion, kaskadierend über org_id,
--  plus rekursives Löschen aller Storage-Präfixe {org_id}/*.
-- =============================================================================
