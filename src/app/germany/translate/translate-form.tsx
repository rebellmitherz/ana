'use client'

import { ArrowLeftRight, Check, Copy } from 'lucide-react'
import { useActionState, useEffect, useState } from 'react'

import type { MessageKey } from '@/core/i18n'
import { useT } from '@/core/i18n/client'
import { translateAction, type TranslateState } from '@/modules/messages/actions'
import { cn } from '@/ui/cn'
import { Button, Card } from '@/ui/primitives'
import { ErrorState } from '@/ui/feedback'
import { VoiceTextInput } from '@/ui/voice/voice-text-input'

type Direction = 'ka-de' | 'de-ka'
type Register = 'private' | 'business' | 'official'

const REGISTERS: { value: Register; label: MessageKey }[] = [
  { value: 'private', label: 'translate.register.private' },
  { value: 'business', label: 'translate.register.business' },
  { value: 'official', label: 'translate.register.official' },
]

export function TranslateForm() {
  const t = useT()
  const [direction, setDirection] = useState<Direction>('ka-de')
  const [register, setRegister] = useState<Register>('private')
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const [state, action, pending] = useActionState<TranslateState, FormData>(translateAction, {
    translation: null,
    note: null,
    error: null,
  })

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={() => setDirection(direction === 'ka-de' ? 'de-ka' : 'ka-de')}
        className="flex w-full items-center justify-center gap-2.5 rounded-control border border-line bg-paper-raised py-3 text-[0.95rem] text-ink transition-colors hover:border-line-strong"
      >
        {t(direction === 'ka-de' ? 'translate.direction.kaDe' : 'translate.direction.deKa')}
        <ArrowLeftRight className="size-4 text-ink-faint" />
      </button>

      <form action={action} className="space-y-3">
        <input type="hidden" name="direction" value={direction} />
        <input type="hidden" name="register" value={register} />
        <input type="hidden" name="text" value={text} />

        <VoiceTextInput
          name="text-visible"
          value={text}
          onChange={setText}
          placeholder={t('translate.placeholder')}
          rows={5}
        />

        <div className="flex gap-1 rounded-full bg-paper-sunken p-1">
          {REGISTERS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              onClick={() => setRegister(entry.value)}
              className={cn(
                'flex-1 rounded-full px-3 py-2 text-sm transition-all duration-250',
                entry.value === register
                  ? 'bg-paper-raised font-medium text-ink shadow-soft'
                  : 'text-ink-muted',
              )}
            >
              {t(entry.label)}
            </button>
          ))}
        </div>

        <Button full size="lg" type="submit" disabled={pending || text.trim().length < 2}>
          {pending ? t('state.loading') : t('translate.title')}
        </Button>
      </form>

      {state.error === 'failed' ? (
        <ErrorState title={t('error.ai.failed')} hint={t('error.generic.hint')} />
      ) : null}

      {state.translation ? (
        <div className="space-y-3 animate-rise">
          <Card className="p-5">
            <p className="mb-2 text-xs text-ink-faint">{t('translate.result')}</p>
            <p
              className={cn(
                'whitespace-pre-wrap text-[1.02rem] leading-relaxed text-ink',
                direction === 'de-ka' && 'text-georgian',
              )}
            >
              {state.translation}
            </p>
          </Card>

          {state.note ? (
            <p className="text-georgian rounded-card bg-gold-soft/50 px-4 py-3 text-sm text-ink-soft">
              {state.note}
            </p>
          ) : null}

          <Button
            tone="secondary"
            full
            onClick={() => {
              void navigator.clipboard.writeText(state.translation ?? '').then(() => setCopied(true))
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? t('action.copied') : t('action.copy')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
