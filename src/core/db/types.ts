/**
 * Datenmodell für ALUBALI V1.
 *
 * Bewusste Abweichungen von docs/DATABASE.sql (dokumentiert in
 * docs/ARCHITECTURE.md, Abschnitt „V1-Abweichungen"):
 *
 *  1. `caregiver_skills` / `caregiver_languages` / `care_case_tasks` sind in V1
 *     typisierte Arrays auf der Hauptzeile statt Junction-Tabellen. Der
 *     eigentliche Grund für Junction-Tabellen war Datenqualität — die wird hier
 *     durch feste Schlüssel-Enums (SkillKey, CareTaskKey) erreicht, nicht durch
 *     Freitext. Migration zu Junctions ist eine reine Datenwanderung.
 *
 *  2. Die Dokumentanalyse liegt als JSON auf der Dokumentzeile. Sie ist 1:1,
 *     schreibgeschützt und von Natur aus verschachtelt — hier ist JSON richtig.
 *
 *  3. `matches` existiert nicht (Architektur K4). Der Score wird live berechnet
 *     und beim Vorschlag als Snapshot auf dem Placement eingefroren.
 */

export type Id = string
/** ISO-8601 Zeitstempel. */
export type Timestamp = string
/** ISO-8601 Datum (YYYY-MM-DD). */
export type DateOnly = string

export interface BaseRow {
  id: Id
  org_id: Id
  created_at: Timestamp
  updated_at: Timestamp
  /** Demo-Daten sind markiert und lassen sich jederzeit vollständig entfernen. */
  is_demo: boolean
  deleted_at: Timestamp | null
}

// ---------------------------------------------------------------------------
// Kataloge
// ---------------------------------------------------------------------------

export const SKILL_KEYS = [
  'dementia',
  'bedridden',
  'mobilization',
  'incontinence',
  'diabetes',
  'palliative',
  'wound_care',
  'medication',
  'stroke',
  'parkinson',
  'cooking',
  'household',
  'companionship',
] as const
export type SkillKey = (typeof SKILL_KEYS)[number]

export const CARE_TASK_KEYS = [
  'personal_hygiene',
  'dressing',
  'cooking',
  'shopping',
  'laundry',
  'cleaning',
  'companionship',
  'walks',
  'doctor_visits',
  'medication',
  'night_care',
  'driving',
] as const
export type CareTaskKey = (typeof CARE_TASK_KEYS)[number]

export const LANGUAGE_CODES = ['ka', 'de', 'ru', 'en', 'tr'] as const
export type LanguageCode = (typeof LANGUAGE_CODES)[number]

/** 0 = keine, 1 = A1 … 6 = C2. Numerisch, damit `>=` direkt funktioniert. */
export type GermanLevel = 0 | 1 | 2 | 3 | 4 | 5 | 6

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const CAREGIVER_STATUSES = [
  'new',
  'incomplete',
  'available',
  'proposed',
  'committed',
  'placed',
  'paused',
  'archived',
] as const
export type CaregiverStatus = (typeof CAREGIVER_STATUSES)[number]

export const CASE_STATUSES = [
  'new',
  'needs_clarified',
  'searching',
  'proposed',
  'interview',
  'confirmed',
  'active',
  'completed',
  'lost',
] as const
export type CaseStatus = (typeof CASE_STATUSES)[number]

export const PLACEMENT_STATUSES = [
  'proposed',
  'accepted',
  'declined',
  'active',
  'ended',
  'cancelled',
] as const
export type PlacementStatus = (typeof PLACEMENT_STATUSES)[number]

export type MobilityLevel = 'mobile' | 'limited' | 'wheelchair' | 'bedridden'
export type DementiaLevel = 'none' | 'mild' | 'moderate' | 'severe'
export type LivingSituation = 'alone' | 'with_partner' | 'with_family' | 'facility'

export type EntityKind = 'caregiver' | 'family' | 'care_case' | 'placement'

export type DocumentKind =
  | 'letter'
  | 'id'
  | 'passport'
  | 'cv'
  | 'reference'
  | 'certificate'
  | 'insurance'
  | 'contract'
  | 'other'

export type TaskStatus = 'open' | 'done' | 'snoozed' | 'cancelled'
export type TaskSource = 'manual' | 'assistant' | 'system'

export type MessageVariantKey = 'natural' | 'short' | 'professional'

export type PersonalCategory = 'favorites' | 'wishlist' | 'restaurant' | 'beauty'

export type DraftState = 'pending' | 'confirmed' | 'discarded' | 'expired'

// ---------------------------------------------------------------------------
// Business-Zeilen
// ---------------------------------------------------------------------------

export interface CaregiverRow extends BaseRow {
  first_name: string
  last_name: string | null
  birth_year: number | null
  phone: string | null
  whatsapp: string | null
  city: string | null
  country: string

  german_level: GermanLevel | null
  languages: { code: LanguageCode; level: GermanLevel }[]
  experience_years: number | null
  skills: SkillKey[]

  driver_license: boolean | null
  smoker: boolean | null
  night_work: boolean | null
  cooking: boolean | null

  available_from: DateOnly | null
  rotation_weeks: number | null
  desired_salary_eur: number | null

  status: CaregiverStatus
  photo_path: string | null
  notes: string | null
}

export interface FamilyRow extends BaseRow {
  contact_name: string
  relation: string | null
  phone: string | null
  email: string | null
  city: string | null
  postal_code: string | null
  notes: string | null
}

export interface CareCaseRow extends BaseRow {
  family_id: Id

  patient_first_name: string | null
  patient_birth_year: number | null

  care_level: number | null
  mobility: MobilityLevel | null
  dementia: DementiaLevel | null

  living_situation: LivingSituation | null
  has_pets: boolean | null
  own_room: boolean | null

  night_work_required: boolean
  driver_license_required: boolean
  smoking_allowed: boolean
  required_german_level: GermanLevel | null

  tasks: CareTaskKey[]

  start_date: DateOnly | null
  expected_months: number | null
  budget_eur: number | null

  status: CaseStatus
  notes: string | null
}

/**
 * Art. 9 DSGVO — besondere Kategorien.
 * Eigene Zeile, eigene Zugriffsregel, kein Audit-Wertdiff, eigene Löschfrist.
 */
export interface CareCaseHealthRow {
  care_case_id: Id
  org_id: Id
  diagnoses: string | null
  medication: string | null
  special_care_notes: string | null
  created_at: Timestamp
  updated_at: Timestamp
  is_demo: boolean
}

export interface MatchReason {
  key: string
  params?: Record<string, string | number>
  polarity: 'positive' | 'neutral' | 'negative'
  points: number
}

export interface ScoreBreakdown {
  availability: number
  skills: number
  german: number
  experience: number
  tasks: number
  preferences: number
  reliability: number
}

export interface PlacementRow extends BaseRow {
  caregiver_id: Id
  care_case_id: Id
  status: PlacementStatus

  /** Snapshot: eingefroren beim Vorschlag, danach nie neu berechnet. */
  match_score: number | null
  match_confidence: number | null
  match_reasons: MatchReason[] | null
  match_breakdown: ScoreBreakdown | null
  matching_version: string | null
  snapshot_created_at: Timestamp | null

  proposed_at: Timestamp | null
  accepted_at: Timestamp | null
  declined_reason: string | null
  start_date: DateOnly | null
  end_date: DateOnly | null

  compensation_eur: number | null
  commission_eur: number | null
  notes: string | null
}

// ---------------------------------------------------------------------------
// Dokumente & Kommunikation
// ---------------------------------------------------------------------------

export interface DocumentAmount {
  label_ka: string
  amount_eur: number
}

export interface DocumentAnalysis {
  document_type: string
  sender: string
  subject_ka: string
  summary_ka: string
  what_they_want_ka: string
  action_required: boolean
  deadline: { date: DateOnly; what_ka: string } | null
  next_steps_ka: string[]
  important_ka: string | null
  amounts: DocumentAmount[]
  advisory_level: 'information' | 'sensitive'
  original_excerpt: string | null
}

export interface DocumentRow extends BaseRow {
  owner_kind: EntityKind | null
  owner_id: Id | null
  kind: DocumentKind
  storage_path: string
  file_name: string
  mime_type: string
  size_bytes: number
  content_hash: string | null
  expires_at: DateOnly | null
  analysis: DocumentAnalysis | null
}

export interface MessageVariant {
  key: MessageVariantKey
  text_de: string
}

export interface MessageRow extends BaseRow {
  owner_kind: EntityKind | null
  owner_id: Id | null
  recipient_name: string | null
  recipient_phone: string | null
  brief_ka: string
  variants: MessageVariant[]
  back_translation_ka: string
  selected_variant: MessageVariantKey
  sent_at: Timestamp | null
}

// ---------------------------------------------------------------------------
// Aufgaben, Notizen, Persönliches
// ---------------------------------------------------------------------------

export interface TaskRow extends BaseRow {
  title: string
  detail: string | null
  due_at: Timestamp | null
  status: TaskStatus
  source: TaskSource
  related_kind: EntityKind | null
  related_id: Id | null
  done_at: Timestamp | null
}

export interface NoteRow extends BaseRow {
  owner_kind: EntityKind | null
  owner_id: Id | null
  body: string
  body_lang: string
  source: TaskSource
  recording_id: Id | null
}

export interface PersonalItemRow extends BaseRow {
  category: PersonalCategory
  title: string
  note: string | null
  url: string | null
  price_eur: number | null
  is_favorite: boolean
  /** Easter Egg: ein Eintrag, der nicht gelöscht werden kann. */
  is_locked: boolean
  position: number
}

// ---------------------------------------------------------------------------
// Assistent & Telemetrie
// ---------------------------------------------------------------------------

export interface VoiceRecordingRow extends BaseRow {
  storage_path: string | null
  duration_sec: number | null
  language: string | null
  transcript: string
  provider: string
  audio_purge_at: Timestamp
}

export interface AssistantDraftRow extends BaseRow {
  tool_name: string
  payload: Record<string, unknown>
  uncertain_fields: string[]
  missing_fields: string[]
  recording_id: Id | null
  state: DraftState
  result_kind: EntityKind | null
  result_id: Id | null
  resolved_at: Timestamp | null
  expires_at: Timestamp
}

export interface AiInteractionRow extends BaseRow {
  kind: string
  provider: string
  model: string
  tier: string | null
  input_tokens: number | null
  output_tokens: number | null
  audio_seconds: number | null
  cost_usd: number | null
  latency_ms: number | null
  tool_name: string | null
  cache_hit: boolean
  success: boolean
  error_code: string | null
}

export interface AuditLogRow extends BaseRow {
  actor_id: Id | null
  table_name: string
  row_id: Id
  op: 'INSERT' | 'UPDATE' | 'DELETE'
  changed_fields: Record<string, unknown> | null
}

// ---------------------------------------------------------------------------
// Tabellenregister
// ---------------------------------------------------------------------------

export interface TableMap {
  caregivers: CaregiverRow
  families: FamilyRow
  care_cases: CareCaseRow
  care_case_health: CareCaseHealthRow & { id: Id; deleted_at: Timestamp | null }
  placements: PlacementRow
  documents: DocumentRow
  messages: MessageRow
  tasks: TaskRow
  notes: NoteRow
  personal_items: PersonalItemRow
  voice_recordings: VoiceRecordingRow
  assistant_drafts: AssistantDraftRow
  ai_interactions: AiInteractionRow
  audit_logs: AuditLogRow
}

export type TableName = keyof TableMap
export type Row<T extends TableName> = TableMap[T]

export const TABLE_NAMES: TableName[] = [
  'caregivers',
  'families',
  'care_cases',
  'care_case_health',
  'placements',
  'documents',
  'messages',
  'tasks',
  'notes',
  'personal_items',
  'voice_recordings',
  'assistant_drafts',
  'ai_interactions',
  'audit_logs',
]
