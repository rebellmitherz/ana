import { Check, Minus, Play, Square } from 'lucide-react'
import { notFound } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import type { PlacementStatus } from '@/core/db/types'
import { formatDate, formatMoney, type MessageKey } from '@/core/i18n'
import { actionContext, pageContext } from '@/modules/app/context'
import { caregiverName } from '@/modules/caregivers/service'
import { getPlacement, setPlacementStatus } from '@/modules/placements/service'
import { reasonText } from '@/modules/matching/reasons'
import { Screen, ScreenHeader, Section } from '@/ui/layout'
import { Button, Card, Chip, SectionTitle } from '@/ui/primitives'

export const dynamic = 'force-dynamic'

async function changeStatus(placementId: string, status: PlacementStatus): Promise<void> {
  'use server'
  const { session } = await actionContext()
  await setPlacementStatus(session, placementId, status)
  revalidatePath(`/business/placements/${placementId}`)
  revalidatePath('/business')
  revalidatePath('/today')
}

const NEXT_ACTIONS: Record<string, { status: PlacementStatus; label: MessageKey; icon: 'check' | 'minus' | 'play' | 'stop' }[]> = {
  proposed: [
    { status: 'accepted', label: 'placement.accept', icon: 'check' },
    { status: 'declined', label: 'placement.decline', icon: 'minus' },
  ],
  accepted: [{ status: 'active', label: 'placement.start', icon: 'play' }],
  active: [{ status: 'ended', label: 'placement.end', icon: 'stop' }],
}

export default async function PlacementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, t } = await pageContext()

  const entry = await getPlacement(session, id)
  if (!entry) notFound()

  const { placement, caregiver, family, careCase } = entry
  const actions = NEXT_ACTIONS[placement.status] ?? []

  return (
    <Screen>
      <ScreenHeader
        title={caregiver ? caregiverName(caregiver) : '—'}
        subtitle={family?.contact_name}
        backHref="/business?tab=placements"
        backLabel={t('business.tab.placements')}
      />

      <Section>
        <div className="flex flex-wrap items-center gap-2">
          <Chip
            tone={
              placement.status === 'active'
                ? 'positive'
                : placement.status === 'proposed'
                  ? 'gold'
                  : 'neutral'
            }
          >
            {t(`placement.status.${placement.status}` as MessageKey)}
          </Chip>
          {placement.start_date ? (
            <Chip tone="neutral">
              {t('placement.period', {
                from: formatDate(placement.start_date),
                to: placement.end_date ? formatDate(placement.end_date) : '…',
              })}
            </Chip>
          ) : null}
        </div>
      </Section>

      {/* Snapshot: eingefroren beim Vorschlag, nie neu berechnet. -------------- */}
      {placement.match_score !== null ? (
        <Section>
          <SectionTitle>{t('placement.snapshot')}</SectionTitle>
          <Card className="p-5">
            <div className="flex items-baseline gap-4">
              <span className="font-display text-[2rem] leading-none text-alubali">
                {placement.match_score}%
              </span>
              <span className="text-sm text-ink-muted">
                {t('matching.confidence')} {placement.match_confidence ?? '—'}%
              </span>
            </div>

            {placement.match_reasons?.length ? (
              <ul className="mt-4 space-y-2 border-t border-line pt-4">
                {placement.match_reasons.map((reason, index) => (
                  <li key={index} className="flex items-start gap-2.5">
                    <span
                      className={`mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full ${
                        reason.polarity === 'positive'
                          ? 'bg-positive-soft text-positive'
                          : reason.polarity === 'negative'
                            ? 'bg-critical-soft text-critical'
                            : 'bg-paper-sunken text-ink-faint'
                      }`}
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

            <p className="mt-4 text-xs text-ink-faint">
              {placement.proposed_at
                ? t('placement.proposedAt', { date: formatDate(placement.proposed_at) })
                : null}
              {placement.matching_version ? ` · v${placement.matching_version}` : null}
            </p>
          </Card>
        </Section>
      ) : null}

      {placement.compensation_eur || placement.commission_eur ? (
        <Section>
          <Card className="divide-y divide-line px-4">
            {placement.compensation_eur ? (
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-muted">{t('caregiver.field.salary')}</span>
                <span className="font-medium text-ink">
                  {formatMoney(placement.compensation_eur)}
                </span>
              </div>
            ) : null}
            {placement.commission_eur ? (
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-ink-muted">Provision</span>
                <span className="font-medium text-ink">{formatMoney(placement.commission_eur)}</span>
              </div>
            ) : null}
          </Card>
        </Section>
      ) : null}

      {placement.notes ? (
        <Section>
          <p className="text-georgian text-[0.95rem] text-ink-soft">{placement.notes}</p>
        </Section>
      ) : null}

      {/* Wichtige Zustandswechsel bleiben eine bewusste Handlung. -------------- */}
      {actions.length > 0 ? (
        <div className="space-y-2 pt-2">
          {actions.map((action, index) => (
            <form key={action.status} action={changeStatus.bind(null, placement.id, action.status)}>
              <Button tone={index === 0 ? 'primary' : 'secondary'} full size="lg" type="submit">
                {action.icon === 'check' ? <Check className="size-4" /> : null}
                {action.icon === 'minus' ? <Minus className="size-4" /> : null}
                {action.icon === 'play' ? <Play className="size-4" /> : null}
                {action.icon === 'stop' ? <Square className="size-4" /> : null}
                {t(action.label)}
              </Button>
            </form>
          ))}
        </div>
      ) : null}

      {careCase ? (
        <p className="mt-6 text-center text-xs text-ink-faint">
          {careCase.patient_first_name ?? ''}
        </p>
      ) : null}
    </Screen>
  )
}
