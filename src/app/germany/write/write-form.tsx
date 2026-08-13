'use client'

import { Check, Copy, RefreshCw, Send } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'

import type { MessageRow, MessageVariantKey } from '@/core/db/types'
import type { MessageKey } from '@/core/i18n'
import { useT } from '@/core/i18n/client'
import { draftMessageAction, markSentAction, type DraftState } from '@/modules/messages/actions'
import { cn } from '@/ui/cn'
import { Button, Card } from '@/ui/primitives'
import { ErrorState } from '@/ui/feedback'
import { VoiceTextInput } from '@/ui/voice/voice-text-input'

/**
 * WOW 2 — „Schreib das für mich".
 *
 * Drei Varianten statt einer: Sie soll wählen, nicht bewerten müssen. Und die
 * georgische Rückübersetzung ist kein Extra, sondern Bestandteil — ohne sie
 * würde sie blind unterschreiben, was in ihrem Namen gesagt wird.
 */

const VARIANT_LABELS: Record<MessageVariantKey, { title: MessageKey; sub: MessageKey }> = {
  natural: { title: 'write.variant.natural', sub: 'write.variant.natural.sub' },
  short: { title: 'write.variant.short', sub: 'write.variant.short.sub' },
  professional: { title: 'write.variant.professional', sub: 'write.variant.professional.sub' },
}

function whatsappHref(text: string, phone?: string | null): string {
  const encoded = encodeURIComponent(text)
  const normalized = phone?.replace(/[^\d]/g, '')
  return normalized ? `https://wa.me/${normalized}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}

export function WriteForm({
  documentId,
  initialMessage,
  initialBrief,
}: {
  documentId?: string
  initialMessage?: MessageRow | null
  initialBrief?: string
}) {
  const t = useT()
  const [brief, setBrief] = useState(initialBrief ?? '')
  const [recipient, setRecipient] = useState(initialMessage?.recipient_name ?? '')
  const [selected, setSelected] = useState<MessageVariantKey>('natural')
  const [copied, setCopied] = useState(false)

  const [state, action, pending] = useActionState<DraftState, FormData>(draftMessageAction, {
    message: initialMessage ?? null,
    error: null,
  })

  const message = state.message
  const variant = message?.variants.find((entry) => entry.key === selected) ?? message?.variants[0]

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    if (!variant) return
    try {
      await navigator.clipboard.writeText(variant.text_de)
      setCopied(true)
    } catch {
      // Ältere iOS-Versionen ohne Clipboard-API: Text bleibt markierbar.
    }
  }

  return (
    <div className="space-y-6">
      <form action={action} className="space-y-3">
        <input type="hidden" name="documentId" value={documentId ?? ''} />
        <input type="hidden" name="brief" value={brief} />

        <div>
          <p className="mb-2 text-sm text-ink-muted">{t('write.prompt')}</p>
          <VoiceTextInput
            name="brief-visible"
            value={brief}
            onChange={setBrief}
            placeholder={t('write.hint')}
            rows={5}
          />
        </div>

        <input
          type="text"
          name="recipient"
          value={recipient}
          onChange={(event) => setRecipient(event.target.value)}
          placeholder={t('write.recipient')}
          className="w-full rounded-control border border-line bg-paper-raised px-4 py-3 text-[1rem] placeholder:text-ink-faint focus:border-gold focus:outline-none"
        />

        <Button full size="lg" type="submit" disabled={pending || brief.trim().length < 3}>
          {pending ? t('write.generating') : message ? t('action.regenerate') : t('write.title')}
        </Button>
      </form>

      {state.error === 'failed' ? (
        <ErrorState title={t('error.ai.failed')} hint={t('error.generic.hint')} />
      ) : null}

      {message && variant ? (
        <div className="space-y-4 animate-rise">
          <div className="flex gap-1 rounded-full bg-paper-sunken p-1">
            {message.variants.map((entry) => (
              <button
                key={entry.key}
                type="button"
                onClick={() => setSelected(entry.key)}
                className={cn(
                  'flex-1 rounded-full px-2 py-2 text-center text-[0.8rem] leading-tight transition-all duration-250',
                  entry.key === selected
                    ? 'bg-paper-raised font-medium text-ink shadow-soft'
                    : 'text-ink-muted',
                )}
              >
                {t(VARIANT_LABELS[entry.key].title)}
              </button>
            ))}
          </div>

          <Card className="p-5">
            <p className="mb-3 text-xs text-ink-faint">{t(VARIANT_LABELS[selected].sub)}</p>
            <p className="whitespace-pre-wrap text-[1rem] leading-relaxed text-ink">
              {variant.text_de}
            </p>
          </Card>

          {/* Rückübersetzung — nicht optional. */}
          <details className="group rounded-card border border-line bg-paper-sunken/60 px-4">
            <summary className="cursor-pointer py-3 text-sm text-ink-muted">
              {t('write.backTranslation')}
            </summary>
            <p className="text-georgian pb-4 text-[0.95rem] text-ink-soft">
              {message.back_translation_ka}
            </p>
          </details>

          <div className="grid grid-cols-2 gap-2">
            <Button tone="secondary" onClick={() => void copy()}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? t('action.copied') : t('action.copy')}
            </Button>
            <a
              href={whatsappHref(variant.text_de, message.recipient_phone)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => void markSentAction(message.id)}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-control bg-alubali px-5 text-[0.95rem] font-medium text-paper-raised shadow-soft transition-all active:scale-[0.985]"
            >
              <Send className="size-4" />
              {t('action.whatsapp')}
            </a>
          </div>

          <form action={action}>
            <input type="hidden" name="brief" value={brief} />
            <input type="hidden" name="recipient" value={recipient} />
            <input type="hidden" name="documentId" value={documentId ?? ''} />
            <Button tone="quiet" full type="submit" disabled={pending}>
              <RefreshCw className="size-4" />
              {t('action.regenerate')}
            </Button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
