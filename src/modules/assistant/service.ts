import 'server-only'

import { runStructured } from '@/core/ai'
import { getScopedStore } from '@/core/db'
import type { AssistantDraftRow, Id } from '@/core/db/types'
import type { Session } from '@/core/auth/session'
import { recordAiUsage } from '@/modules/audit'

import {
  caregiverExtractionSchema,
  familyExtractionSchema,
  routeSchema,
  taskExtractionSchema,
  type ToolName,
} from './schemas'
import {
  CAREGIVER_SYSTEM,
  contextPreamble,
  FAMILY_SYSTEM,
  ROUTE_SYSTEM,
  TASK_SYSTEM,
} from './prompts'
import { normalizeCaregiver, normalizeDate, normalizeFamily } from './normalize'

/**
 * Der Assistent.
 *
 * Architekturregel, die hier durchgesetzt wird: Ein Sprachmodell schreibt
 * niemals in eine Business-Tabelle. Es erzeugt einen `assistant_draft` — eine
 * eigene Zeile, ohne Referenzen aus dem Businessmodell, mit 24 Stunden
 * Lebensdauer. Erst die Bestätigung der Nutzerin macht daraus einen Datensatz.
 */

export interface DraftResult {
  draft: AssistantDraftRow
  toolName: ToolName
  transcript: string
}

/** Kontext-Hinweis aus dem Bildschirm, von dem aus gesprochen wurde. */
export type CaptureContext = 'home' | 'caregiver' | 'family' | 'note'

async function usageRecorder(session: Session, toolName?: string) {
  return async (entry: Parameters<typeof recordAiUsage>[1]) => {
    await recordAiUsage(session, { ...entry, toolName: toolName ?? null })
  }
}

/**
 * Bestimmt, was die Nutzerin gerade tun wollte.
 *
 * Der Bildschirmkontext ist ein starker Prior: Wer im Pflegerinnen-Bereich
 * spricht, meint fast immer eine Pflegerin. Das spart einen Modellaufruf und
 * erhöht die Trefferquote deutlich (docs/ARCHITECTURE.md, K2).
 */
export async function routeUtterance(
  session: Session,
  transcript: string,
  context: CaptureContext = 'home',
): Promise<ToolName> {
  if (context === 'caregiver') return 'createCaregiverDraft'
  if (context === 'family') return 'createFamilyDraft'
  if (context === 'note') return 'createNote'

  const result = await runStructured(
    {
      task: 'assistant.route',
      system: ROUTE_SYSTEM,
      user: transcript,
      schema: routeSchema,
      schemaName: 'route_utterance',
      schemaDescription: 'Ordnet eine Äußerung einer Aktion zu',
      maxOutputTokens: 256,
    },
    { onUsage: await usageRecorder(session) },
  )

  // Unsichere Zuordnungen landen als Notiz. Nichts geht verloren, nichts wird
  // fälschlich als Pflegerin angelegt.
  return result.data.confidence >= 0.6 ? result.data.tool : 'createNote'
}

async function createDraft(
  session: Session,
  input: {
    toolName: ToolName
    payload: Record<string, unknown>
    missing: string[]
    uncertain: string[]
    recordingId: Id | null
  },
): Promise<AssistantDraftRow> {
  const store = await getScopedStore(session.orgId)
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  return store.insert('assistant_drafts', {
    tool_name: input.toolName,
    payload: input.payload,
    uncertain_fields: input.uncertain,
    missing_fields: input.missing,
    recording_id: input.recordingId,
    state: 'pending',
    result_kind: null,
    result_id: null,
    resolved_at: null,
    expires_at: expires,
  })
}

export async function buildCaregiverDraft(
  session: Session,
  transcript: string,
  recordingId: Id | null,
): Promise<DraftResult> {
  const result = await runStructured(
    {
      task: 'caregiver.extract',
      system: `${CAREGIVER_SYSTEM}\n\n${contextPreamble()}`,
      user: transcript,
      schema: caregiverExtractionSchema,
      schemaName: 'caregiver_fields',
      schemaDescription: 'Strukturierte Felder einer Betreuungskraft',
    },
    { onUsage: await usageRecorder(session, 'createCaregiverDraft') },
  )

  const { values, missing, uncertain } = normalizeCaregiver(result.data, transcript)

  const draft = await createDraft(session, {
    toolName: 'createCaregiverDraft',
    payload: values as Record<string, unknown>,
    missing,
    uncertain,
    recordingId,
  })

  return { draft, toolName: 'createCaregiverDraft', transcript }
}

export async function buildFamilyDraft(
  session: Session,
  input: string,
  recordingId: Id | null,
): Promise<DraftResult> {
  const result = await runStructured(
    {
      task: 'family.extract',
      system: `${FAMILY_SYSTEM}\n\n${contextPreamble()}`,
      user: input,
      schema: familyExtractionSchema,
      schemaName: 'family_case_fields',
      schemaDescription: 'Strukturierte Felder einer Familie mit Pflegebedarf',
    },
    { onUsage: await usageRecorder(session, 'createFamilyDraft') },
  )

  const { values, missing, uncertain } = normalizeFamily(result.data, input)

  const draft = await createDraft(session, {
    toolName: 'createFamilyDraft',
    payload: values as unknown as Record<string, unknown>,
    missing,
    uncertain,
    recordingId,
  })

  return { draft, toolName: 'createFamilyDraft', transcript: input }
}

export async function buildTaskDraft(
  session: Session,
  transcript: string,
  recordingId: Id | null,
): Promise<DraftResult> {
  const result = await runStructured(
    {
      task: 'assistant.route',
      system: `${TASK_SYSTEM}\n\n${contextPreamble()}`,
      user: transcript,
      schema: taskExtractionSchema,
      schemaName: 'task_fields',
      maxOutputTokens: 256,
    },
    { onUsage: await usageRecorder(session, 'createTask') },
  )

  const draft = await createDraft(session, {
    toolName: 'createTask',
    payload: {
      title: result.data.title,
      detail: result.data.detail ?? null,
      due_at: normalizeDate(result.data.due_at),
    },
    missing: [],
    uncertain: [],
    recordingId,
  })

  return { draft, toolName: 'createTask', transcript }
}

/** Notiz: kein Modellaufruf nötig — das Transkript ist die Notiz. */
export async function buildNoteDraft(
  session: Session,
  transcript: string,
  recordingId: Id | null,
): Promise<DraftResult> {
  const draft = await createDraft(session, {
    toolName: 'createNote',
    payload: { body: transcript, body_lang: 'ka' },
    missing: [],
    uncertain: [],
    recordingId,
  })

  return { draft, toolName: 'createNote', transcript }
}

/**
 * Kompletter Weg von einer Äußerung zu einem bestätigungsfähigen Entwurf.
 *
 * Fehlerverhalten: Scheitert die Extraktion, wird das Transkript trotzdem als
 * Notiz-Entwurf gesichert. Es gibt keinen Pfad, auf dem Gesprochenes verloren
 * geht — das ist die Grundlage dafür, dass sie der App vertraut.
 */
export async function processUtterance(
  session: Session,
  transcript: string,
  recordingId: Id | null,
  context: CaptureContext = 'home',
): Promise<DraftResult> {
  let toolName: ToolName = 'createNote'

  try {
    toolName = await routeUtterance(session, transcript, context)
  } catch (error) {
    console.error('[assistant] Routing gescheitert, weiche auf Notiz aus:', error)
    return buildNoteDraft(session, transcript, recordingId)
  }

  try {
    switch (toolName) {
      case 'createCaregiverDraft':
        return await buildCaregiverDraft(session, transcript, recordingId)
      case 'createFamilyDraft':
        return await buildFamilyDraft(session, transcript, recordingId)
      case 'createTask':
        return await buildTaskDraft(session, transcript, recordingId)
      case 'createNote':
        return await buildNoteDraft(session, transcript, recordingId)
    }
  } catch (error) {
    console.error('[assistant] Extraktion gescheitert, weiche auf Notiz aus:', error)
    return buildNoteDraft(session, transcript, recordingId)
  }
}

export async function getDraft(session: Session, id: Id): Promise<AssistantDraftRow | null> {
  const store = await getScopedStore(session.orgId)
  const draft = await store.get('assistant_drafts', id)
  if (!draft || draft.state !== 'pending') return draft
  if (new Date(draft.expires_at) < new Date()) {
    await store.update('assistant_drafts', id, { state: 'expired' })
    return { ...draft, state: 'expired' }
  }
  return draft
}

export async function discardDraft(session: Session, id: Id): Promise<void> {
  const store = await getScopedStore(session.orgId)
  await store.update('assistant_drafts', id, { state: 'discarded' })
}
