import { randomUUID } from 'node:crypto'
import { NextResponse } from 'next/server'

import { getSession } from '@/core/auth/session'
import { getScopedStore } from '@/core/db'
import { putObject } from '@/core/storage'
import { transcribe } from '@/core/speech'
import { recordAiUsage } from '@/modules/audit'
import { vocabularyForSpeech } from '@/modules/caregivers/service'
import { processUtterance, type CaptureContext } from '@/modules/assistant/service'

export const runtime = 'nodejs'
export const maxDuration = 60

const MAX_AUDIO_BYTES = 25 * 1024 * 1024
const VALID_CONTEXTS: CaptureContext[] = ['home', 'caregiver', 'family', 'note']

/**
 * Aufnahme → Transkript → Entwurf.
 *
 * Was hier NICHT passiert: ein Schreibvorgang in eine Business-Tabelle. Am Ende
 * steht ein `assistant_draft`. Erst die Bestätigung der Nutzerin macht daraus
 * einen Datensatz.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const audio = form.get('audio')
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: 'no_audio' }, { status: 400 })
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 413 })
  }

  const rawContext = String(form.get('context') ?? 'home')
  const context = (VALID_CONTEXTS as string[]).includes(rawContext)
    ? (rawContext as CaptureContext)
    : 'home'

  try {
    // Eigennamen aus ihrer Datenbank als Bias — aus „Nino" wird so nicht „Nina".
    const vocabulary = await vocabularyForSpeech(session).catch(() => [])

    const started = Date.now()
    const result = await transcribe({
      audio,
      languageHint: 'ka',
      vocabulary,
    })

    await recordAiUsage(session, {
      task: 'transcribe',
      provider: result.provider,
      model: 'stt',
      tier: 'speech',
      inputTokens: 0,
      outputTokens: 0,
      audioSeconds: result.durationSec,
      costUsd: (result.durationSec / 60) * 0.006,
      latencyMs: Date.now() - started,
      cacheHit: false,
      success: true,
      errorCode: null,
    })

    const store = await getScopedStore(session.orgId)

    // Audio bewusst getrennt vom Transkript: Die Datei wird nach 30 Tagen
    // gelöscht, das Transkript bleibt. Teil des Löschkonzepts.
    const extension = audio.name.split('.').pop() ?? 'webm'
    const objectPath = `${session.orgId}/voice/${randomUUID()}.${extension}`
    await putObject(objectPath, await audio.arrayBuffer(), audio.type || 'audio/webm').catch(
      (error: unknown) => {
        console.error('[voice] Audio konnte nicht abgelegt werden:', error)
      },
    )

    const recording = await store.insert('voice_recordings', {
      storage_path: objectPath,
      duration_sec: result.durationSec,
      language: result.language,
      transcript: result.text,
      provider: result.provider,
      audio_purge_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      is_demo: false,
    })

    const draft = await processUtterance(session, result.text, recording.id, context)

    return NextResponse.json({
      draftId: draft.draft.id,
      toolName: draft.toolName,
      transcript: result.text,
    })
  } catch (error) {
    console.error('[voice] Verarbeitung gescheitert:', error)
    return NextResponse.json({ error: 'processing_failed' }, { status: 500 })
  }
}
