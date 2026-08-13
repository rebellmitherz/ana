import { NextResponse } from 'next/server'

import { getSession } from '@/core/auth/session'
import { transcribe } from '@/core/speech'
import { recordAiUsage } from '@/modules/audit'
import { vocabularyForSpeech } from '@/modules/caregivers/service'

export const runtime = 'nodejs'
export const maxDuration = 60

/**
 * Reine Transkription ohne Routing.
 *
 * Wird überall dort verwendet, wo Sprache nur ein bequemerer Weg zum Tippen ist
 * (Nachricht diktieren, Übersetzung einsprechen) — nicht als Auslöser einer
 * Aktion. Deshalb entsteht hier kein Entwurf und kein Datensatz.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const audio = form?.get('audio')
  if (!(audio instanceof File) || audio.size === 0) {
    return NextResponse.json({ error: 'no_audio' }, { status: 400 })
  }

  try {
    const started = Date.now()
    const vocabulary = await vocabularyForSpeech(session).catch(() => [])
    const result = await transcribe({ audio, languageHint: 'ka', vocabulary })

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

    return NextResponse.json({ text: result.text })
  } catch (error) {
    console.error('[transcribe] gescheitert:', error)
    return NextResponse.json({ error: 'failed' }, { status: 500 })
  }
}
