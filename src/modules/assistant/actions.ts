'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { getScopedStore } from '@/core/db'
import type { CareCaseRow, CareTaskKey, GermanLevel, SkillKey } from '@/core/db/types'
import { actionContext } from '@/modules/app/context'
import { createCaregiver } from '@/modules/caregivers/service'
import { createFamilyWithCase } from '@/modules/families/service'
import { createNote, createTask } from '@/modules/tasks/service'

import { buildCaregiverDraft, buildFamilyDraft, discardDraft, getDraft } from './service'

/**
 * Bestätigung eines Entwurfs.
 *
 * Das ist die Stelle, an der aus einem Modellvorschlag ein Datensatz wird —
 * und die einzige. Ausgelöst wird sie ausschließlich durch eine bewusste
 * Handlung der Nutzerin.
 */

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asBool(value: unknown): boolean | null {
  if (typeof value === 'boolean') return value
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

function asArray<T extends string>(value: unknown): T[] {
  return Array.isArray(value) ? (value.filter((entry) => typeof entry === 'string') as T[]) : []
}

function nested(payload: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = payload[key]
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export async function confirmDraftAction(draftId: string, payloadJson: string): Promise<void> {
  const { session } = await actionContext()
  const draft = await getDraft(session, draftId)
  if (!draft || draft.state !== 'pending') throw new Error('Entwurf nicht mehr gültig')

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(payloadJson) as Record<string, unknown>
  } catch {
    throw new Error('Ungültige Daten')
  }

  const store = await getScopedStore(session.orgId)
  const resolvedAt = new Date().toISOString()
  let target = '/'

  if (draft.tool_name === 'createCaregiverDraft') {
    const caregiver = await createCaregiver(session, {
      first_name: asString(payload.first_name) ?? 'ვინმე',
      last_name: asString(payload.last_name),
      birth_year: asNumber(payload.birth_year),
      phone: asString(payload.phone),
      whatsapp: asString(payload.phone),
      city: asString(payload.city),
      german_level: asNumber(payload.german_level) as GermanLevel | null,
      experience_years: asNumber(payload.experience_years),
      skills: asArray<SkillKey>(payload.skills),
      driver_license: asBool(payload.driver_license),
      smoker: asBool(payload.smoker),
      night_work: asBool(payload.night_work),
      cooking: asBool(payload.cooking),
      available_from: asString(payload.available_from),
      rotation_weeks: asNumber(payload.rotation_weeks),
      notes: asString(payload.notes),
    })

    // Das Transkript bleibt als Notiz erhalten — nichts Gesprochenes geht verloren.
    if (draft.recording_id) {
      const recording = await store.get('voice_recordings', draft.recording_id)
      if (recording) {
        await createNote(session, {
          body: recording.transcript,
          ownerKind: 'caregiver',
          ownerId: caregiver.id,
          recordingId: recording.id,
          source: 'assistant',
        })
      }
    }

    await store.update('assistant_drafts', draftId, {
      state: 'confirmed',
      result_kind: 'caregiver',
      result_id: caregiver.id,
      resolved_at: resolvedAt,
    })
    target = `/business/caregivers/${caregiver.id}`
  } else if (draft.tool_name === 'createFamilyDraft') {
    const family = nested(payload, 'family')
    const careCase = nested(payload, 'careCase')

    const created = await createFamilyWithCase(session, {
      family: {
        contact_name: asString(family.contact_name) ?? 'ოჯახი',
        relation: asString(family.relation),
        phone: asString(family.phone),
        email: asString(family.email),
        city: asString(family.city),
      },
      careCase: {
        patient_first_name: asString(careCase.patient_first_name),
        patient_birth_year: asNumber(careCase.patient_birth_year),
        care_level: asNumber(careCase.care_level),
        mobility: (asString(careCase.mobility) as CareCaseRow['mobility']) ?? null,
        dementia: (asString(careCase.dementia) as CareCaseRow['dementia']) ?? null,
        living_situation:
          (asString(careCase.living_situation) as CareCaseRow['living_situation']) ?? null,
        own_room: asBool(careCase.own_room),
        night_work_required: asBool(careCase.night_work_required) ?? false,
        driver_license_required: asBool(careCase.driver_license_required) ?? false,
        smoking_allowed: asBool(careCase.smoking_allowed) ?? false,
        required_german_level: asNumber(careCase.required_german_level) as GermanLevel | null,
        tasks: asArray<CareTaskKey>(careCase.tasks),
        start_date: asString(careCase.start_date),
        expected_months: asNumber(careCase.expected_months),
        budget_eur: asNumber(careCase.budget_eur),
        notes: asString(careCase.notes),
        status: 'needs_clarified',
      },
      diagnoses: asString(payload.diagnoses),
    })

    await store.update('assistant_drafts', draftId, {
      state: 'confirmed',
      result_kind: 'care_case',
      result_id: created.careCase.id,
      resolved_at: resolvedAt,
    })
    target = `/business/cases/${created.careCase.id}`
  } else if (draft.tool_name === 'createTask') {
    const task = await createTask(session, {
      title: asString(payload.title) ?? '—',
      detail: asString(payload.detail),
      dueAt: asString(payload.due_at),
      source: 'assistant',
    })
    await store.update('assistant_drafts', draftId, {
      state: 'confirmed',
      result_id: task.id,
      resolved_at: resolvedAt,
    })
    target = '/today'
  } else {
    const note = await createNote(session, {
      body: asString(payload.body) ?? '',
      recordingId: draft.recording_id,
      source: 'assistant',
    })
    await store.update('assistant_drafts', draftId, {
      state: 'confirmed',
      result_id: note.id,
      resolved_at: resolvedAt,
    })
    target = '/today'
  }

  revalidatePath('/', 'layout')
  redirect(target)
}

export async function discardDraftAction(draftId: string): Promise<void> {
  const { session } = await actionContext()
  await discardDraft(session, draftId)
  redirect('/')
}

/** Familie aus deutschem Freitext, z. B. einer weitergeleiteten E-Mail. */
export async function captureFamilyFromTextAction(formData: FormData): Promise<void> {
  const { session } = await actionContext()
  const text = String(formData.get('text') ?? '').trim()
  if (text.length < 10) return

  const result = await buildFamilyDraft(session, text, null)
  redirect(`/confirm/${result.draft.id}`)
}

/** Pflegerin aus getipptem Text — Sprechen ist nie Pflicht. */
export async function captureCaregiverFromTextAction(formData: FormData): Promise<void> {
  const { session } = await actionContext()
  const text = String(formData.get('text') ?? '').trim()
  if (text.length < 5) return

  const result = await buildCaregiverDraft(session, text, null)
  redirect(`/confirm/${result.draft.id}`)
}
