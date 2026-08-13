import type {
  CareCaseRow,
  CareTaskKey,
  CaregiverRow,
  FamilyRow,
  GermanLevel,
  SkillKey,
} from '@/core/db/types'
import {
  isCareTaskKey,
  isSkillKey,
  type CaregiverExtraction,
  type FamilyExtraction,
} from './schemas'

/**
 * Normalisierung von Modellausgaben in Domänenwerte.
 *
 * Reine Funktionen, vollständig testbar, ohne Datenbank und ohne Netz.
 * Hier — und nur hier — wird entschieden, was ein Modell tatsächlich sagen
 * darf und was verworfen wird.
 */

export interface NormalizedDraft<T> {
  values: T
  /** Wichtige Felder, die niemand genannt hat. Werden als Frage angezeigt. */
  missing: string[]
  /** Felder, deren Wert nicht im Transkript belegt ist. Werden gold markiert. */
  uncertain: string[]
}

// ---------------------------------------------------------------------------
// Grundbausteine
// ---------------------------------------------------------------------------

export function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null
  const trimmed = value.trim()

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`

  const german = /^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/.exec(trimmed)
  if (german) {
    const [, d, m, y] = german
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`
  }

  const parsed = new Date(trimmed)
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10)
  return null
}

export function clampInt(
  value: number | null | undefined,
  min: number,
  max: number,
): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  const rounded = Math.round(value)
  if (rounded < min || rounded > max) return null
  return rounded
}

export function toGermanLevel(value: number | null | undefined): GermanLevel | null {
  const clamped = clampInt(value, 0, 6)
  return clamped === null ? null : (clamped as GermanLevel)
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

/**
 * Belegprüfung: Kommt der Wert im Transkript tatsächlich vor?
 *
 * Das ist die billigste wirksame Bremse gegen erfundene Angaben — und gegen
 * Erkennungsfehler bei Zahlen, wo georgisches STT am schwächsten ist. Was hier
 * durchfällt, wird nicht verworfen, sondern in der Karte gold markiert.
 */
function isSupported(transcript: string, needle: string | number | null): boolean {
  if (needle === null) return true
  const haystack = transcript.toLowerCase().replace(/\s+/g, ' ')
  return haystack.includes(String(needle).toLowerCase())
}

// ---------------------------------------------------------------------------
// Pflegerin
// ---------------------------------------------------------------------------

export type CaregiverDraftValues = Partial<
  Pick<
    CaregiverRow,
    | 'first_name'
    | 'last_name'
    | 'birth_year'
    | 'phone'
    | 'city'
    | 'german_level'
    | 'experience_years'
    | 'skills'
    | 'driver_license'
    | 'smoker'
    | 'night_work'
    | 'cooking'
    | 'available_from'
    | 'rotation_weeks'
    | 'notes'
  >
>

const CAREGIVER_IMPORTANT_FIELDS = [
  'german_level',
  'experience_years',
  'available_from',
  'skills',
  'phone',
] as const

const GERMAN_LEVEL_LABELS = ['', 'a1', 'a2', 'b1', 'b2', 'c1', 'c2']

export function normalizeCaregiver(
  extraction: CaregiverExtraction,
  transcript: string,
): NormalizedDraft<CaregiverDraftValues> {
  const currentYear = new Date().getFullYear()
  const birthYear = clampInt(extraction.birth_year, currentYear - 80, currentYear - 18)
  const germanLevel = toGermanLevel(extraction.german_level)
  const experienceYears = clampInt(extraction.experience_years, 0, 60)

  const skills = (extraction.skills ?? []).filter(isSkillKey) as SkillKey[]

  const values: CaregiverDraftValues = {
    first_name: cleanText(extraction.first_name) ?? undefined,
    last_name: cleanText(extraction.last_name),
    birth_year: birthYear,
    phone: cleanText(extraction.phone),
    city: cleanText(extraction.city),
    german_level: germanLevel,
    experience_years: experienceYears,
    skills,
    driver_license: extraction.driver_license ?? null,
    smoker: extraction.smoker ?? null,
    night_work: extraction.night_work ?? null,
    cooking: extraction.cooking ?? null,
    available_from: normalizeDate(extraction.available_from),
    rotation_weeks: clampInt(extraction.rotation_weeks, 1, 52),
    notes: cleanText(extraction.notes),
  }

  const missing = CAREGIVER_IMPORTANT_FIELDS.filter((field) => {
    const value = values[field]
    return value === null || value === undefined || (Array.isArray(value) && value.length === 0)
  })

  const uncertain: string[] = []
  // Alter: wir prüfen die genannte Zahl, nicht das errechnete Geburtsjahr.
  if (birthYear !== null && !isSupported(transcript, currentYear - birthYear)) {
    uncertain.push('birth_year')
  }
  if (experienceYears !== null && !isSupported(transcript, experienceYears)) {
    uncertain.push('experience_years')
  }
  if (germanLevel !== null && germanLevel > 0) {
    const label = GERMAN_LEVEL_LABELS[germanLevel] ?? ''
    const compact = transcript.toLowerCase().replace(/\s+/g, '')
    if (!compact.includes(label)) uncertain.push('german_level')
  }

  return { values, missing, uncertain }
}

// ---------------------------------------------------------------------------
// Familie + Pflegefall
// ---------------------------------------------------------------------------

export type FamilyDraftValues = {
  family: Partial<Pick<FamilyRow, 'contact_name' | 'relation' | 'phone' | 'email' | 'city' | 'notes'>>
  careCase: Partial<
    Pick<
      CareCaseRow,
      | 'patient_first_name'
      | 'patient_birth_year'
      | 'care_level'
      | 'mobility'
      | 'dementia'
      | 'living_situation'
      | 'own_room'
      | 'night_work_required'
      | 'driver_license_required'
      | 'smoking_allowed'
      | 'required_german_level'
      | 'tasks'
      | 'start_date'
      | 'expected_months'
      | 'budget_eur'
      | 'notes'
    >
  >
  /** Art. 9 DSGVO — geht in eine eigene Zeile mit eigener Zugriffsregel. */
  diagnoses: string | null
}

const FAMILY_IMPORTANT_FIELDS = ['start_date', 'care_level', 'mobility', 'contact_name'] as const

export function normalizeFamily(
  extraction: FamilyExtraction,
  transcript: string,
): NormalizedDraft<FamilyDraftValues> {
  const currentYear = new Date().getFullYear()
  const patientBirthYear = clampInt(extraction.patient_birth_year, currentYear - 110, currentYear)
  const tasks = (extraction.tasks ?? []).filter(isCareTaskKey) as CareTaskKey[]

  const values: FamilyDraftValues = {
    family: {
      contact_name: cleanText(extraction.contact_name) ?? undefined,
      relation: cleanText(extraction.relation),
      phone: cleanText(extraction.phone),
      email: cleanText(extraction.email),
      city: cleanText(extraction.city),
      notes: null,
    },
    careCase: {
      patient_first_name: cleanText(extraction.patient_first_name),
      patient_birth_year: patientBirthYear,
      care_level: clampInt(extraction.care_level, 0, 5),
      mobility: extraction.mobility ?? null,
      dementia: extraction.dementia ?? null,
      living_situation: extraction.living_situation ?? null,
      own_room: extraction.own_room ?? null,
      night_work_required: extraction.night_work_required ?? false,
      driver_license_required: extraction.driver_license_required ?? false,
      smoking_allowed: extraction.smoking_allowed ?? false,
      required_german_level: toGermanLevel(extraction.required_german_level),
      tasks,
      start_date: normalizeDate(extraction.start_date),
      expected_months: clampInt(extraction.expected_months, 1, 120),
      budget_eur: clampInt(extraction.budget_eur, 0, 20_000),
      notes: cleanText(extraction.notes),
    },
    diagnoses: cleanText(extraction.diagnoses),
  }

  const missing = FAMILY_IMPORTANT_FIELDS.filter((field) => {
    const value =
      field === 'contact_name'
        ? values.family.contact_name
        : values.careCase[field as keyof typeof values.careCase]
    return value === null || value === undefined
  })

  const uncertain: string[] = []
  if (patientBirthYear !== null && !isSupported(transcript, currentYear - patientBirthYear)) {
    uncertain.push('patient_birth_year')
  }
  if (values.careCase.budget_eur !== null && !isSupported(transcript, values.careCase.budget_eur!)) {
    uncertain.push('budget_eur')
  }

  return { values, missing, uncertain }
}
