'use server'

import { revalidatePath } from 'next/cache'

import type { MessageRow } from '@/core/db/types'
import { actionContext } from '@/modules/app/context'
import { getDocument } from '@/modules/documents/service'
import {
  draftMessage,
  markMessageSent,
  translateText,
  type TranslateDirection,
  type TranslateRegister,
} from './service'

export interface DraftState {
  message: MessageRow | null
  error: 'empty' | 'failed' | null
}

export async function draftMessageAction(
  _previous: DraftState,
  formData: FormData,
): Promise<DraftState> {
  const { session } = await actionContext()

  const brief = String(formData.get('brief') ?? '').trim()
  if (brief.length < 3) return { message: null, error: 'empty' }

  const recipient = String(formData.get('recipient') ?? '').trim() || null
  const documentId = String(formData.get('documentId') ?? '').trim() || null

  // Antwortet sie auf einen Brief, bekommt das Modell dessen Kern als Kontext —
  // aber nur die Zusammenfassung, nie das ganze Dokument.
  let replyContext: string | null = null
  if (documentId) {
    const document = await getDocument(session, documentId)
    if (document?.analysis) {
      replyContext = [
        `Absender: ${document.analysis.sender}`,
        `Betreff: ${document.analysis.subject_ka}`,
        `Anliegen: ${document.analysis.what_they_want_ka}`,
      ].join('\n')
    }
  }

  try {
    const message = await draftMessage(session, {
      briefKa: brief,
      recipientName: recipient,
      replyContext,
    })
    revalidatePath('/germany')
    return { message, error: null }
  } catch (error) {
    console.error('[messages] Entwurf gescheitert:', error)
    return { message: null, error: 'failed' }
  }
}

export async function markSentAction(messageId: string): Promise<void> {
  const { session } = await actionContext()
  await markMessageSent(session, messageId)
}

export interface TranslateState {
  translation: string | null
  note: string | null
  error: 'empty' | 'failed' | null
}

export async function translateAction(
  _previous: TranslateState,
  formData: FormData,
): Promise<TranslateState> {
  const { session } = await actionContext()

  const text = String(formData.get('text') ?? '').trim()
  if (text.length < 2) return { translation: null, note: null, error: 'empty' }

  const direction = (String(formData.get('direction') ?? 'ka-de') as TranslateDirection) ?? 'ka-de'
  const register = (String(formData.get('register') ?? 'private') as TranslateRegister) ?? 'private'

  try {
    const result = await translateText(session, { text, direction, register })
    return { translation: result.translation, note: result.note, error: null }
  } catch (error) {
    console.error('[messages] Übersetzung gescheitert:', error)
    return { translation: null, note: null, error: 'failed' }
  }
}
