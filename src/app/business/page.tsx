import { Briefcase, Plus, Users } from 'lucide-react'
import Link from 'next/link'

import type { MessageKey } from '@/core/i18n'
import { pageContext } from '@/modules/app/context'
import { listCaregivers } from '@/modules/caregivers/service'
import { listCases } from '@/modules/families/service'
import { listPlacements } from '@/modules/placements/service'
import { Screen, ScreenHeader } from '@/ui/layout'
import { ButtonLink } from '@/ui/primitives'
import { EmptyState } from '@/ui/feedback'
import { CaregiverCard, CaseCard, PlacementCard } from '@/ui/patterns/entity-cards'
import { VoiceCapture } from '@/ui/voice/voice-capture'

export const dynamic = 'force-dynamic'

type Tab = 'caregivers' | 'families' | 'placements'

const TABS: { value: Tab; label: MessageKey }[] = [
  { value: 'caregivers', label: 'business.tab.caregivers' },
  { value: 'families', label: 'business.tab.families' },
  { value: 'placements', label: 'business.tab.placements' },
]

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: rawTab } = await searchParams
  const { session, t } = await pageContext()

  const tab: Tab = TABS.some((entry) => entry.value === rawTab) ? (rawTab as Tab) : 'caregivers'

  const [caregivers, cases, placements] = await Promise.all([
    listCaregivers(session),
    listCases(session),
    listPlacements(session),
  ])

  const proposalsByCase = new Map<string, number>()
  for (const entry of placements) {
    const key = entry.placement.care_case_id
    proposalsByCase.set(key, (proposalsByCase.get(key) ?? 0) + 1)
  }

  return (
    <Screen>
      <ScreenHeader title={t('business.title')} backHref="/" backLabel={t('action.back')} />

      {/* Segmentierte Umschaltung als Links — bleibt serverseitig gerendert.
          Die Leiste scrollt statt zu kürzen: georgische Wörter sind lang, und ein
          abgeschnittenes „განთავსებე…" wäre schlechter als eine Wischgeste. */}
      <div className="-mx-5 mb-6 overflow-x-auto px-5">
        <div className="inline-flex min-w-full gap-1 rounded-full bg-paper-sunken p-1">
          {TABS.map((entry) => (
            <Link
              key={entry.value}
              href={`/business?tab=${entry.value}`}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-center text-[0.85rem] transition-all duration-250 ${
                entry.value === tab
                  ? 'bg-paper-raised font-medium text-ink shadow-soft'
                  : 'text-ink-muted'
              }`}
            >
              {t(entry.label)}
            </Link>
          ))}
        </div>
      </div>

      {tab === 'caregivers' ? (
        caregivers.length === 0 ? (
          <EmptyState
            icon={<Users className="size-7" strokeWidth={1.4} />}
            title={t('caregivers.empty')}
            hint={t('caregivers.empty.hint')}
            action={
              <ButtonLink href="/business/caregivers/new" tone="secondary">
                <Plus className="size-4" />
                {t('caregivers.add')}
              </ButtonLink>
            }
          />
        ) : (
          <div className="space-y-2.5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-ink-muted">
                {t('caregivers.count', { count: caregivers.length })}
              </p>
              <ButtonLink href="/business/caregivers/new" tone="ghost" size="sm">
                <Plus className="size-4" />
                {t('action.add')}
              </ButtonLink>
            </div>
            {caregivers.map((row) => (
              <CaregiverCard key={row.id} row={row} t={t} />
            ))}
          </div>
        )
      ) : null}

      {tab === 'families' ? (
        cases.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="size-7" strokeWidth={1.4} />}
            title={t('families.empty')}
            hint={t('families.empty.hint')}
            action={
              <ButtonLink href="/business/cases/new" tone="secondary">
                <Plus className="size-4" />
                {t('families.add')}
              </ButtonLink>
            }
          />
        ) : (
          <div className="space-y-2.5">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-ink-muted">{t('families.count', { count: cases.length })}</p>
              <ButtonLink href="/business/cases/new" tone="ghost" size="sm">
                <Plus className="size-4" />
                {t('action.add')}
              </ButtonLink>
            </div>
            {cases.map((entry) => (
              <CaseCard
                key={entry.careCase.id}
                careCase={entry.careCase}
                family={entry.family}
                t={t}
                proposalCount={proposalsByCase.get(entry.careCase.id) ?? 0}
              />
            ))}
          </div>
        )
      ) : null}

      {tab === 'placements' ? (
        placements.length === 0 ? (
          <EmptyState title={t('placements.empty')} />
        ) : (
          <div className="space-y-2.5">
            {placements.map((entry) => (
              <PlacementCard
                key={entry.placement.id}
                placement={entry.placement}
                caregiver={entry.caregiver}
                family={entry.family}
                t={t}
              />
            ))}
          </div>
        )
      ) : null}

      <VoiceCapture context={tab === 'families' ? 'family' : 'caregiver'} variant="fab" />
    </Screen>
  )
}
