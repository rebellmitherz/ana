import 'server-only'

import { runStructured } from '@/core/ai'
import { getScopedStore } from '@/core/db'
import type { EntityKind, Id, MessageRow, MessageVariantKey } from '@/core/db/types'
import type { Session } from '@/core/auth/session'
import { recordAiUsage } from '@/modules/audit'
import { messageDraftSchema, translationSchema } from '@/modules/assistant/schemas'
import { MESSAGE_SYSTEM, TRANSLATE_SYSTEM, contextPreamble } from '@/modules/assistant/prompts'

/**
 * WOW 2 — „Schreib das für mich".
 *
 * Sie sagt auf Georgisch, was gemeint ist. Heraus kommen drei deutsche
 * Varianten und — verpflichtend — eine georgische Rückübersetzung. Ohne die
 * Rückübersetzung würde sie blind unterschreiben, was in ihrem Namen gesagt wird.
 *
 * Gesendet wird nie automatisch: Kopieren oder WhatsApp öffnen, den Sendeknopf
 * drückt sie selbst. Das ist zugleich die günstigste und die ehrlichste Lösung.
 */

const VARIANT_ORDER: MessageVariantKey[] = ['natural', 'short', 'professional']

export async function draftMessage(
  session: Session,
  input: {
    briefKa: string
    recipientName?: string | null
    recipientPhone?: string | null
    ownerKind?: EntityKind | null
    ownerId?: Id | null
    /** Kontext eines Briefs, auf den geantwortet wird. */
    replyContext?: string | null
  },
): Promise<MessageRow> {
  const contextLines = [
    input.recipientName ? `Empfängerin/Empfänger: ${input.recipientName}` : null,
    input.replyContext ? `Es handelt sich um eine Antwort auf:\n${input.replyContext}` : null,
    contextPreamble(),
  ].filter(Boolean)

  const result = await runStructured(
    {
      task: 'message.draft',
      system: `${MESSAGE_SYSTEM}\n\n${contextLines.join('\n')}`,
      user: input.briefKa,
      schema: messageDraftSchema,
      schemaName: 'message_variants',
      schemaDescription: 'Drei deutsche Varianten plus georgische Rückübersetzung',
      maxOutputTokens: 1600,
    },
    { onUsage: async (entry) => recordAiUsage(session, { ...entry, toolName: 'draftGermanMessage' }) },
  )

  // Reihenfolge festzurren, damit die UI stabil bleibt, egal was das Modell liefert.
  const variants = VARIANT_ORDER.map((key) => {
    const found = result.data.variants.find((variant) => variant.key === key)
    return { key, text_de: found?.text_de ?? result.data.variants[0]?.text_de ?? '' }
  }).filter((variant) => variant.text_de.length > 0)

  const store = await getScopedStore(session.orgId)
  return store.insert('messages', {
    owner_kind: input.ownerKind ?? null,
    owner_id: input.ownerId ?? null,
    recipient_name: input.recipientName ?? null,
    recipient_phone: input.recipientPhone ?? null,
    brief_ka: input.briefKa,
    variants,
    back_translation_ka: result.data.back_translation_ka,
    selected_variant: 'natural',
    sent_at: null,
    is_demo: false,
  })
}

export async function getMessage(session: Session, id: Id): Promise<MessageRow | null> {
  const store = await getScopedStore(session.orgId)
  return store.get('messages', id)
}

export async function listMessages(session: Session, limit = 20): Promise<MessageRow[]> {
  const store = await getScopedStore(session.orgId)
  return store.list('messages', {
    orderBy: { column: 'created_at', ascending: false },
    limit,
  })
}

export async function markMessageSent(session: Session, id: Id): Promise<void> {
  const store = await getScopedStore(session.orgId)
  await store.update('messages', id, { sent_at: new Date().toISOString() })
}

// ---------------------------------------------------------------------------

export type TranslateDirection = 'ka-de' | 'de-ka'
export type TranslateRegister = 'private' | 'business' | 'official'

export async function translateText(
  session: Session,
  input: { text: string; direction: TranslateDirection; register: TranslateRegister },
): Promise<{ translation: string; note: string | null }> {
  const result = await runStructured(
    {
      task: 'translate',
      system: TRANSLATE_SYSTEM(input.direction, input.register),
      user: input.text,
      schema: translationSchema,
      schemaName: 'translation',
      maxOutputTokens: 1600,
    },
    { onUsage: async (entry) => recordAiUsage(session, { ...entry, toolName: 'translateText' }) },
  )

  return { translation: result.data.translation, note: result.data.note ?? null }
}

/**
 * WhatsApp-Weiterleitung ohne Business-API: ein Deep Link mit vorbefülltem Text.
 * Kostenlos, sofort verfügbar, und der Sendeknopf bleibt bei ihr.
 */
export function whatsappUrl(text: string, phone?: string | null): string {
  const encoded = encodeURIComponent(text)
  const normalized = phone?.replace(/[^\d]/g, '')
  return normalized
    ? `https://wa.me/${normalized}?text=${encoded}`
    : `https://wa.me/?text=${encoded}`
}
