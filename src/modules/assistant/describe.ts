import type { MessageKey } from '@/core/i18n'
import { CARE_TASK_KEYS, SKILL_KEYS } from '@/core/db/types'

import type { ToolName } from './schemas'

/**
 * Übersetzt einen Entwurf in eine anzeigbare Feldliste.
 *
 * Bewusst deterministisch und ohne zweiten Modellaufruf: Die Karte darf nie
 * etwas anderes zeigen, als tatsächlich gespeichert wird.
 */

export type FieldType =
  | 'text'
  | 'number'
  | 'date'
  | 'bool'
  | 'german'
  | 'skills'
  | 'tasks'
  | 'longtext'
  | 'enum'

export interface DraftField {
  key: string
  labelKey: MessageKey
  type: FieldType
  value: unknown
  uncertain: boolean
  missing: boolean
  /** Wichtig genug, um bei Fehlen aktiv nachzufragen. */
  ask: boolean
  /** Nur bei `enum`: i18n-Präfix und erlaubte Werte. */
  enumPrefix?: string
  enumOptions?: readonly string[]
}

export interface DraftDescription {
  titleKey: MessageKey
  fields: DraftField[]
}

interface Spec {
  key: string
  labelKey: MessageKey
  type: FieldType
  ask?: boolean
  enumPrefix?: string
  enumOptions?: readonly string[]
}

const MOBILITY_OPTIONS = ['mobile', 'limited', 'wheelchair', 'bedridden'] as const
const DEMENTIA_OPTIONS = ['none', 'mild', 'moderate', 'severe'] as const
const LIVING_OPTIONS = ['alone', 'with_partner', 'with_family', 'facility'] as const

const CAREGIVER_SPECS: Spec[] = [
  { key: 'first_name', labelKey: 'caregiver.field.firstName', type: 'text' },
  { key: 'last_name', labelKey: 'caregiver.field.lastName', type: 'text' },
  { key: 'birth_year', labelKey: 'caregiver.field.age', type: 'number', ask: true },
  { key: 'experience_years', labelKey: 'caregiver.field.experienceYears', type: 'number', ask: true },
  { key: 'german_level', labelKey: 'caregiver.field.germanLevel', type: 'german', ask: true },
  { key: 'skills', labelKey: 'caregiver.field.skills', type: 'skills', ask: true },
  { key: 'available_from', labelKey: 'caregiver.field.availableFrom', type: 'date', ask: true },
  { key: 'driver_license', labelKey: 'caregiver.field.driverLicense', type: 'bool', ask: true },
  { key: 'smoker', labelKey: 'caregiver.field.smoker', type: 'bool' },
  { key: 'night_work', labelKey: 'caregiver.field.nightWork', type: 'bool' },
  { key: 'cooking', labelKey: 'caregiver.field.cooking', type: 'bool' },
  { key: 'rotation_weeks', labelKey: 'caregiver.field.rotationWeeks', type: 'number' },
  { key: 'phone', labelKey: 'caregiver.field.phone', type: 'text', ask: true },
  { key: 'city', labelKey: 'caregiver.field.city', type: 'text' },
  { key: 'notes', labelKey: 'caregiver.field.notes', type: 'longtext' },
]

const FAMILY_SPECS: Spec[] = [
  { key: 'family.contact_name', labelKey: 'family.field.contactName', type: 'text', ask: true },
  { key: 'family.relation', labelKey: 'family.field.relation', type: 'text' },
  { key: 'family.phone', labelKey: 'family.field.phone', type: 'text' },
  { key: 'family.city', labelKey: 'family.field.city', type: 'text' },
  { key: 'careCase.patient_first_name', labelKey: 'family.field.patientName', type: 'text' },
  { key: 'careCase.patient_birth_year', labelKey: 'family.field.patientAge', type: 'number', ask: true },
  { key: 'careCase.care_level', labelKey: 'family.field.careLevel', type: 'number', ask: true },
  {
    key: 'careCase.mobility',
    labelKey: 'family.field.mobility',
    type: 'enum',
    ask: true,
    enumPrefix: 'mobility.',
    enumOptions: MOBILITY_OPTIONS,
  },
  {
    key: 'careCase.dementia',
    labelKey: 'family.field.dementia',
    type: 'enum',
    enumPrefix: 'dementia.',
    enumOptions: DEMENTIA_OPTIONS,
  },
  {
    key: 'careCase.living_situation',
    labelKey: 'family.field.livingSituation',
    type: 'enum',
    enumPrefix: 'living.',
    enumOptions: LIVING_OPTIONS,
  },
  { key: 'careCase.start_date', labelKey: 'family.field.startDate', type: 'date', ask: true },
  { key: 'careCase.required_german_level', labelKey: 'family.field.requiredGermanLevel', type: 'german' },
  { key: 'careCase.tasks', labelKey: 'family.field.tasks', type: 'tasks' },
  { key: 'careCase.night_work_required', labelKey: 'family.field.nightWork', type: 'bool' },
  { key: 'careCase.driver_license_required', labelKey: 'family.field.driverLicense', type: 'bool' },
  { key: 'careCase.budget_eur', labelKey: 'family.field.budget', type: 'number' },
  { key: 'diagnoses', labelKey: 'family.field.health', type: 'longtext' },
]

const TASK_SPECS: Spec[] = [
  { key: 'title', labelKey: 'task.title', type: 'text' },
  { key: 'due_at', labelKey: 'task.due', type: 'date' },
  { key: 'detail', labelKey: 'caregiver.field.notes', type: 'longtext' },
]

const NOTE_SPECS: Spec[] = [{ key: 'body', labelKey: 'confirm.title.note', type: 'longtext' }]

const SPECS: Record<ToolName, { titleKey: MessageKey; specs: Spec[] }> = {
  createCaregiverDraft: { titleKey: 'confirm.title.caregiver', specs: CAREGIVER_SPECS },
  createFamilyDraft: { titleKey: 'confirm.title.family', specs: FAMILY_SPECS },
  createTask: { titleKey: 'confirm.title.task', specs: TASK_SPECS },
  createNote: { titleKey: 'confirm.title.note', specs: NOTE_SPECS },
}

function readPath(payload: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, segment) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[segment]
    }
    return undefined
  }, payload)
}

export function describeDraft(
  toolName: string,
  payload: Record<string, unknown>,
  uncertain: string[],
  missing: string[],
): DraftDescription {
  const entry = SPECS[toolName as ToolName] ?? SPECS.createNote

  const fields = entry.specs.map<DraftField>((spec) => {
    const value = readPath(payload, spec.key)
    const leaf = spec.key.split('.').pop() ?? spec.key
    const isEmpty =
      value === null ||
      value === undefined ||
      value === '' ||
      (Array.isArray(value) && value.length === 0)

    return {
      key: spec.key,
      labelKey: spec.labelKey,
      type: spec.type,
      value: value ?? null,
      uncertain: uncertain.includes(leaf) || uncertain.includes(spec.key),
      missing: isEmpty,
      ask: Boolean(spec.ask) && isEmpty && (missing.includes(leaf) || missing.includes(spec.key)),
      enumPrefix: spec.enumPrefix,
      enumOptions: spec.enumOptions,
    }
  })

  return { titleKey: entry.titleKey, fields }
}

/** Nur Felder mit Wert anzeigen — plus die, nach denen aktiv gefragt wird. */
export function visibleFields(fields: DraftField[]): DraftField[] {
  return fields.filter((field) => !field.missing || field.ask)
}

export const SKILL_OPTIONS = SKILL_KEYS
export const TASK_OPTIONS = CARE_TASK_KEYS
