import { z } from 'zod'

import { CARE_TASK_KEYS, SKILL_KEYS, type CareTaskKey, type SkillKey } from '@/core/db/types'

/**
 * Schemas für alles, was ein Sprachmodell zurückgeben darf.
 *
 * Bewusst OHNE `.transform()`: Diese Schemas werden nach JSON Schema übersetzt
 * und dem Modell als Vertrag vorgelegt. Normalisierung (Datumsformate,
 * unbekannte Schlüssel, Wertebereiche) passiert danach in `normalize.ts` —
 * dort, wo sie testbar ist.
 *
 * Bewusst PERMISSIV: Ein Modell, das ein Feld weglässt, darf nicht die ganze
 * Extraktion zum Absturz bringen. Fehlend heißt `null`, und `null` ist eine
 * gültige, sichtbare Antwort in der Bestätigungskarte.
 */

const nullableText = z.string().nullish()
const nullableNumber = z.number().nullish()
const nullableBool = z.boolean().nullish()

/** Freitext-Datum. Das Modell darf ISO oder deutsches Format liefern. */
const looseDate = z
  .string()
  .nullish()
  .describe('Datum als YYYY-MM-DD, oder null wenn nicht genannt')

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export const TOOL_NAMES = [
  'createCaregiverDraft',
  'createFamilyDraft',
  'createTask',
  'createNote',
] as const
export type ToolName = (typeof TOOL_NAMES)[number]

export const routeSchema = z.object({
  tool: z.enum(TOOL_NAMES).describe('Welches Tool passt zu dieser Äußerung'),
  confidence: z.number().min(0).max(1).describe('Wie sicher, 0 bis 1'),
  reasoning_ka: z.string().nullish().describe('Eine kurze Begründung auf Georgisch'),
})
export type RouteResult = z.infer<typeof routeSchema>

// ---------------------------------------------------------------------------
// Pflegerin erfassen
// ---------------------------------------------------------------------------

export const caregiverExtractionSchema = z.object({
  first_name: nullableText.describe('Vorname, lateinisch transkribiert'),
  last_name: nullableText,
  birth_year: nullableNumber.describe('Geburtsjahr; wenn nur das Alter genannt wurde, ausrechnen'),
  phone: nullableText,
  city: nullableText,
  german_level: nullableNumber.describe('0=keine, 1=A1, 2=A2, 3=B1, 4=B2, 5=C1, 6=C2'),
  experience_years: nullableNumber.describe('Jahre Pflegeerfahrung'),
  skills: z
    .array(z.string())
    .nullish()
    .describe(`Nur aus dieser Liste: ${SKILL_KEYS.join(', ')}`),
  driver_license: nullableBool,
  smoker: nullableBool,
  night_work: nullableBool,
  cooking: nullableBool,
  available_from: looseDate,
  rotation_weeks: nullableNumber.describe('Gewünschte Rotation in Wochen'),
  notes: nullableText.describe('Alles Gesagte, das in kein Feld passt'),
})
export type CaregiverExtraction = z.infer<typeof caregiverExtractionSchema>

// ---------------------------------------------------------------------------
// Familie / Pflegefall erfassen
// ---------------------------------------------------------------------------

export const familyExtractionSchema = z.object({
  contact_name: nullableText.describe('Name der Kontaktperson oder der Familie'),
  relation: nullableText.describe('Verhältnis zur betreuten Person, z. B. Tochter'),
  phone: nullableText,
  email: nullableText,
  city: nullableText,

  patient_first_name: nullableText,
  patient_birth_year: nullableNumber,
  care_level: nullableNumber.describe('Pflegegrad 0 bis 5'),
  mobility: z.enum(['mobile', 'limited', 'wheelchair', 'bedridden']).nullish(),
  dementia: z.enum(['none', 'mild', 'moderate', 'severe']).nullish(),
  living_situation: z.enum(['alone', 'with_partner', 'with_family', 'facility']).nullish(),

  night_work_required: nullableBool,
  driver_license_required: nullableBool,
  smoking_allowed: nullableBool,
  own_room: nullableBool,
  required_german_level: nullableNumber.describe('0=keine, 1=A1, 2=A2, 3=B1, 4=B2, 5=C1, 6=C2'),

  tasks: z
    .array(z.string())
    .nullish()
    .describe(`Nur aus dieser Liste: ${CARE_TASK_KEYS.join(', ')}`),

  start_date: looseDate,
  expected_months: nullableNumber,
  budget_eur: nullableNumber.describe('Monatliches Budget in Euro'),
  notes: nullableText,

  /** Art. 9 DSGVO — wird getrennt gespeichert. */
  diagnoses: nullableText.describe('Genannte Diagnosen im Wortlaut'),
})
export type FamilyExtraction = z.infer<typeof familyExtractionSchema>

// ---------------------------------------------------------------------------
// Aufgabe / Notiz
// ---------------------------------------------------------------------------

export const taskExtractionSchema = z.object({
  title: z.string().describe('Kurze Aufgabe auf Georgisch'),
  due_at: looseDate.describe('Fälligkeit als YYYY-MM-DD'),
  detail: nullableText,
})
export type TaskExtraction = z.infer<typeof taskExtractionSchema>

// ---------------------------------------------------------------------------
// Dokument erklären
// ---------------------------------------------------------------------------

export const documentAnalysisSchema = z.object({
  document_type: z
    .enum([
      'krankenkasse',
      'rente',
      'finanzamt',
      'auslaenderbehoerde',
      'arbeitsagentur',
      'vermieter',
      'versicherung',
      'rechnung',
      'mahnung',
      'arzt',
      'sonstiges',
    ])
    .describe('Art des Dokuments'),
  sender: z.string().describe('Wer schreibt — Name der Behörde, Firma oder Person'),
  subject_ka: z.string().describe('Betreff in einem Satz, auf Georgisch'),
  summary_ka: z.string().describe('Worum es geht, 2 bis 4 Sätze, einfaches Georgisch'),
  what_they_want_ka: z.string().describe('Was konkret von ihr verlangt wird, auf Georgisch'),
  action_required: z.boolean().describe('Muss sie reagieren'),
  deadline: z
    .object({
      date: z.string().describe('YYYY-MM-DD'),
      what_ka: z.string().describe('Was bis dahin passieren muss, auf Georgisch'),
    })
    .nullish(),
  next_steps_ka: z
    .array(z.string())
    .describe('Bis zu 4 konkrete nächste Schritte, auf Georgisch'),
  important_ka: nullableText.describe('Was besonders wichtig ist, auf Georgisch'),
  amounts: z
    .array(z.object({ label_ka: z.string(), amount_eur: z.number() }))
    .nullish()
    .describe('Genannte Geldbeträge'),
  advisory_level: z
    .enum(['information', 'sensitive'])
    .describe(
      'sensitive bei rechtlichen, steuerlichen, aufenthaltsrechtlichen oder medizinischen Inhalten',
    ),
  original_excerpt: nullableText.describe('Die ersten Sätze des Originaltexts, unverändert'),
})
export type DocumentAnalysisResult = z.infer<typeof documentAnalysisSchema>

// ---------------------------------------------------------------------------
// Nachricht entwerfen
// ---------------------------------------------------------------------------

export const messageDraftSchema = z.object({
  variants: z
    .array(
      z.object({
        key: z.enum(['natural', 'short', 'professional']),
        text_de: z.string().describe('Der fertige deutsche Text'),
      }),
    )
    .describe('Genau drei Varianten: natural, short, professional'),
  back_translation_ka: z
    .string()
    .describe('Was die natürliche Variante auf Georgisch bedeutet — Pflichtfeld'),
})
export type MessageDraftResult = z.infer<typeof messageDraftSchema>

// ---------------------------------------------------------------------------
// Übersetzen
// ---------------------------------------------------------------------------

export const translationSchema = z.object({
  translation: z.string(),
  note: nullableText.describe('Nur wenn etwas kulturell erklärt werden muss'),
})
export type TranslationResult = z.infer<typeof translationSchema>

// ---------------------------------------------------------------------------
// Hilfsprädikate für die Normalisierung
// ---------------------------------------------------------------------------

export function isSkillKey(value: string): value is SkillKey {
  return (SKILL_KEYS as readonly string[]).includes(value)
}

export function isCareTaskKey(value: string): value is CareTaskKey {
  return (CARE_TASK_KEYS as readonly string[]).includes(value)
}
