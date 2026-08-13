'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { CaregiverRow, CareTaskKey, GermanLevel, SkillKey } from '@/core/db/types'
import { actionContext } from '@/modules/app/context'
import { createCaregiver, deleteCaregiver, updateCaregiver } from './service'
import { createFamilyWithCase, updateCase, updateFamily } from '@/modules/families/service'
import { createTask } from '@/modules/tasks/service'

function str(value: FormDataEntryValue | null): string | null {
  const text = typeof value === 'string' ? value.trim() : ''
  return text.length > 0 ? text : null
}

function num(value: FormDataEntryValue | null): number | null {
  const text = str(value)
  if (text === null) return null
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : null
}

function bool(value: FormDataEntryValue | null): boolean | null {
  const text = str(value)
  if (text === 'true') return true
  if (text === 'false') return false
  return null
}

// ---------------------------------------------------------------------------

export async function saveCaregiverFieldsAction(
  caregiverId: string,
  patchJson: string,
): Promise<void> {
  const { session } = await actionContext()

  let patch: Record<string, unknown>
  try {
    patch = JSON.parse(patchJson) as Record<string, unknown>
  } catch {
    return
  }

  const allowed: (keyof CaregiverRow)[] = [
    'first_name',
    'last_name',
    'birth_year',
    'phone',
    'city',
    'german_level',
    'experience_years',
    'skills',
    'driver_license',
    'smoker',
    'night_work',
    'cooking',
    'available_from',
    'rotation_weeks',
    'desired_salary_eur',
    'notes',
  ]

  const clean: Partial<CaregiverRow> = {}
  for (const key of allowed) {
    if (key in patch) {
      // Der Wert kommt aus der eigenen UI, wird aber trotzdem nur über die
      // Whitelist übernommen — der Client bestimmt nie, welche Spalte er trifft.
      Object.assign(clean, { [key]: patch[key] })
    }
  }

  await updateCaregiver(session, caregiverId, clean)
  revalidatePath(`/business/caregivers/${caregiverId}`)
  revalidatePath('/business')
}

export async function createCaregiverAction(formData: FormData): Promise<void> {
  const { session } = await actionContext()

  const firstName = str(formData.get('first_name'))
  if (!firstName) return

  const skills = formData.getAll('skills').filter((v): v is string => typeof v === 'string')

  const caregiver = await createCaregiver(session, {
    first_name: firstName,
    last_name: str(formData.get('last_name')),
    birth_year: num(formData.get('birth_year')),
    phone: str(formData.get('phone')),
    whatsapp: str(formData.get('phone')),
    city: str(formData.get('city')),
    german_level: num(formData.get('german_level')) as GermanLevel | null,
    experience_years: num(formData.get('experience_years')),
    skills: skills as SkillKey[],
    driver_license: bool(formData.get('driver_license')),
    smoker: bool(formData.get('smoker')),
    night_work: bool(formData.get('night_work')),
    cooking: bool(formData.get('cooking')),
    available_from: str(formData.get('available_from')),
    rotation_weeks: num(formData.get('rotation_weeks')),
    notes: str(formData.get('notes')),
  })

  revalidatePath('/business')
  redirect(`/business/caregivers/${caregiver.id}`)
}

export async function deleteCaregiverAction(caregiverId: string): Promise<void> {
  const { session } = await actionContext()
  await deleteCaregiver(session, caregiverId)
  revalidatePath('/business')
  redirect('/business?tab=caregivers')
}

/** Fehlende Angabe wird zur Aufgabe statt zum Malus. */
export async function askAboutFieldAction(
  caregiverId: string,
  caregiverName: string,
  question: string,
): Promise<void> {
  const { session } = await actionContext()
  await createTask(session, {
    title: `${caregiverName}: ${question}`,
    relatedKind: 'caregiver',
    relatedId: caregiverId,
    source: 'system',
  })
  revalidatePath('/today')
  revalidatePath(`/business/caregivers/${caregiverId}`)
}

// ---------------------------------------------------------------------------

export async function createFamilyAction(formData: FormData): Promise<void> {
  const { session } = await actionContext()

  const contactName = str(formData.get('contact_name'))
  if (!contactName) return

  const tasks = formData.getAll('tasks').filter((v): v is string => typeof v === 'string')

  const created = await createFamilyWithCase(session, {
    family: {
      contact_name: contactName,
      relation: str(formData.get('relation')),
      phone: str(formData.get('phone')),
      email: str(formData.get('email')),
      city: str(formData.get('city')),
    },
    careCase: {
      patient_first_name: str(formData.get('patient_first_name')),
      patient_birth_year: num(formData.get('patient_birth_year')),
      care_level: num(formData.get('care_level')),
      mobility: (str(formData.get('mobility')) as never) ?? null,
      dementia: (str(formData.get('dementia')) as never) ?? null,
      required_german_level: num(formData.get('required_german_level')) as GermanLevel | null,
      tasks: tasks as CareTaskKey[],
      start_date: str(formData.get('start_date')),
      expected_months: num(formData.get('expected_months')),
      budget_eur: num(formData.get('budget_eur')),
      night_work_required: bool(formData.get('night_work_required')) ?? false,
      driver_license_required: bool(formData.get('driver_license_required')) ?? false,
      smoking_allowed: bool(formData.get('smoking_allowed')) ?? false,
      notes: str(formData.get('notes')),
      status: 'needs_clarified',
    },
    diagnoses: str(formData.get('diagnoses')),
  })

  revalidatePath('/business')
  redirect(`/business/cases/${created.careCase.id}`)
}

export async function saveCaseFieldsAction(caseId: string, patchJson: string): Promise<void> {
  const { session } = await actionContext()

  let patch: Record<string, unknown>
  try {
    patch = JSON.parse(patchJson) as Record<string, unknown>
  } catch {
    return
  }

  const caseFields = [
    'patient_first_name',
    'patient_birth_year',
    'care_level',
    'mobility',
    'dementia',
    'living_situation',
    'own_room',
    'night_work_required',
    'driver_license_required',
    'smoking_allowed',
    'required_german_level',
    'tasks',
    'start_date',
    'expected_months',
    'budget_eur',
    'notes',
  ]
  const familyFields = ['contact_name', 'relation', 'phone', 'email', 'city']

  const casePatch: Record<string, unknown> = {}
  const familyPatch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(patch)) {
    const leaf = key.split('.').pop() ?? key
    if (caseFields.includes(leaf)) casePatch[leaf] = value
    if (familyFields.includes(leaf)) familyPatch[leaf] = value
  }

  if (Object.keys(casePatch).length > 0) {
    await updateCase(session, caseId, casePatch)
  }
  if (Object.keys(familyPatch).length > 0) {
    const { getCase } = await import('@/modules/families/service')
    const entry = await getCase(session, caseId)
    if (entry) await updateFamily(session, entry.family.id, familyPatch)
  }

  revalidatePath(`/business/cases/${caseId}`)
  revalidatePath('/business')
}
