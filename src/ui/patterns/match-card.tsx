'use client'

import { Check, ChevronDown, Minus, Plus } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import type { MatchReason } from '@/core/db/types'
import { useT } from '@/core/i18n/client'
import { reasonText } from '@/modules/matching/reasons'
import { cn } from '@/ui/cn'
import { Card } from '@/ui/primitives'

/**
 * Eine Kandidatin mit Begründung.
 *
 * Zwei Zahlen statt einer: Passung und Datensicherheit. Ein 95-%-Match auf
 * Basis von drei bekannten Feldern ist gefährlicher als ein ehrliches
 * „91 %, Sicherheit 70 %" — deshalb steht beides nebeneinander.
 *
 * Die Begründungen kosten keinen einzigen AI-Aufruf: Sie entstehen direkt aus
 * den Score-Beiträgen und werden über i18n-Schlüssel gerendert.
 */
export function MatchCard({
  caregiverId,
  caregiverName,
  subtitle,
  score,
  confidence,
  reasons,
  alreadyProposed,
  caseId,
  onPropose,
}: {
  caregiverId: string
  caregiverName: string
  subtitle: string
  score: number
  confidence: number
  reasons: MatchReason[]
  alreadyProposed: boolean
  caseId: string
  onPropose: (caseId: string, caregiverId: string) => Promise<{ ok: boolean }>
}) {
  const t = useT()
  const [open, setOpen] = useState(false)
  const [proposed, setProposed] = useState(alreadyProposed)
  const [pending, startTransition] = useTransition()

  const tone = score >= 80 ? 'text-positive' : score >= 55 ? 'text-gold-deep' : 'text-ink-muted'

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        <div className="flex shrink-0 flex-col items-center">
          <span className={cn('font-display text-[1.6rem] leading-none', tone)}>{score}</span>
          <span className="mt-0.5 text-[0.65rem] text-ink-faint">%</span>
        </div>

        <div className="min-w-0 flex-1">
          <Link
            href={`/business/caregivers/${caregiverId}`}
            className="block truncate font-display text-[1.1rem] text-ink hover:text-alubali"
          >
            {caregiverName}
          </Link>
          <p className="mt-0.5 truncate text-sm text-ink-muted">{subtitle}</p>

          <div className="mt-2.5 flex items-center gap-2">
            <div className="h-1 flex-1 overflow-hidden rounded-full bg-paper-sunken">
              <div
                className="h-full rounded-full bg-ink-faint/60 transition-all duration-700"
                style={{ width: `${confidence}%` }}
              />
            </div>
            <span className="shrink-0 text-[0.7rem] text-ink-faint">
              {t('matching.confidence')} {confidence}%
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between border-t border-line px-4 py-2.5 text-sm text-ink-muted transition-colors hover:bg-paper-sunken/50"
      >
        {t('matching.why')}
        <ChevronDown className={cn('size-4 transition-transform duration-300', open && 'rotate-180')} />
      </button>

      {open ? (
        <ul className="space-y-2 border-t border-line bg-paper-sunken/40 px-4 py-3.5 animate-in">
          {reasons.map((reason, index) => (
            <li key={index} className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full',
                  reason.polarity === 'positive'
                    ? 'bg-positive-soft text-positive'
                    : reason.polarity === 'negative'
                      ? 'bg-critical-soft text-critical'
                      : 'bg-paper-sunken text-ink-faint',
                )}
              >
                {reason.polarity === 'positive' ? (
                  <Check className="size-2.5" strokeWidth={3} />
                ) : reason.polarity === 'negative' ? (
                  <Minus className="size-2.5" strokeWidth={3} />
                ) : null}
              </span>
              <span className="text-georgian text-[0.9rem] leading-snug text-ink-soft">
                {reasonText(t, reason)}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="border-t border-line p-3">
        <button
          type="button"
          disabled={proposed || pending}
          onClick={() =>
            startTransition(async () => {
              const result = await onPropose(caseId, caregiverId)
              if (result.ok) setProposed(true)
            })
          }
          className={cn(
            'flex h-11 w-full items-center justify-center gap-2 rounded-control text-[0.95rem] font-medium transition-all',
            proposed
              ? 'bg-positive-soft text-positive'
              : 'bg-alubali text-paper-raised active:scale-[0.985] disabled:opacity-60',
          )}
        >
          {proposed ? <Check className="size-4" /> : <Plus className="size-4" />}
          {proposed ? t('matching.proposed') : t('matching.propose')}
        </button>
      </div>
    </Card>
  )
}
