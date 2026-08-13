import { Lock, Phone } from 'lucide-react'
import { notFound } from 'next/navigation'

import { formatDate, formatMoney, germanLevelKey } from '@/core/i18n'
import { pageContext } from '@/modules/app/context'
import { getCase, getCaseHealth, patientAge } from '@/modules/families/service'
import { saveCaseFieldsAction } from '@/modules/caregivers/actions'
import { findMatches } from '@/modules/matching/service'
import { proposeCandidateAction } from '@/modules/matching/actions'
import { listPlacementsForCase } from '@/modules/placements/service'
import { caregiverName } from '@/modules/caregivers/service'
import { describeDraft, TASK_OPTIONS } from '@/modules/assistant/describe'
import { Screen, ScreenHeader, Section } from '@/ui/layout'
import { Card, Chip, GoldRule, SectionTitle } from '@/ui/primitives'
import { EmptyState } from '@/ui/feedback'
import { EntityDetail } from '@/ui/patterns/entity-detail'
import { MatchCard } from '@/ui/patterns/match-card'
import { PlacementCard } from '@/ui/patterns/entity-cards'
import { StatusRail } from '@/ui/patterns/status-rail'

export const dynamic = 'force-dynamic'

const CASE_FLOW = [
  'new',
  'needs_clarified',
  'searching',
  'proposed',
  'interview',
  'confirmed',
  'active',
] as const

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, t } = await pageContext()

  const entry = await getCase(session, id)
  if (!entry) notFound()

  const { careCase, family } = entry
  const [health, matches, placements] = await Promise.all([
    getCaseHealth(session, id),
    findMatches(session, id),
    listPlacementsForCase(session, id),
  ])

  const age = patientAge(careCase)
  const proposedIds = new Set(placements.map((entry) => entry.placement.caregiver_id))

  // Dieselbe Feldbeschreibung wie in der Bestätigungskarte.
  const description = describeDraft(
    'createFamilyDraft',
    { family, careCase } as unknown as Record<string, unknown>,
    [],
    ['start_date', 'care_level', 'mobility', 'contact_name', 'patient_birth_year'],
  )

  return (
    <Screen>
      <ScreenHeader
        title={family.contact_name}
        subtitle={
          [careCase.patient_first_name, age ? `${age}` : null, family.city]
            .filter(Boolean)
            .join(' · ') || undefined
        }
        backHref="/business?tab=families"
        backLabel={t('business.tab.families')}
      />

      <Section>
        <StatusRail
          steps={CASE_FLOW.map((status) => ({
            key: status,
            label: t(`family.status.${status}` as never),
          }))}
          current={careCase.status}
        />
      </Section>

      <Section>
        <div className="flex flex-wrap items-center gap-2">
          {careCase.start_date ? (
            <Chip tone="gold">{formatDate(careCase.start_date)}</Chip>
          ) : null}
          {careCase.care_level !== null ? (
            <Chip tone="neutral">Pflegegrad {careCase.care_level}</Chip>
          ) : null}
          {careCase.required_german_level !== null ? (
            <Chip tone="neutral">{t(germanLevelKey(careCase.required_german_level))}</Chip>
          ) : null}
          {careCase.budget_eur ? (
            <Chip tone="neutral">{formatMoney(careCase.budget_eur)}</Chip>
          ) : null}
          {family.phone ? (
            <a
              href={`tel:${family.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper-sunken px-3 py-1 text-[0.8rem] text-ink-soft transition-colors hover:text-alubali"
            >
              <Phone className="size-3" />
              {family.phone}
            </a>
          ) : null}
        </div>
      </Section>

      <Section>
        <EntityDetail
          fields={description.fields.filter((field) => field.key !== 'diagnoses')}
          entityId={careCase.id}
          onSave={saveCaseFieldsAction}
          taskOptions={TASK_OPTIONS}
          missingTitle="caregiver.missing"
        />
      </Section>

      {/* Art. 9 DSGVO — sichtbar abgesetzt, damit der Sonderstatus spürbar ist. */}
      {health ? (
        <Section>
          <Card className="border-line-strong bg-paper-sunken/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm text-ink-muted">
              <Lock className="size-3.5" />
              {t('family.field.health')}
            </p>
            <p className="text-[0.95rem] leading-relaxed text-ink-soft">{health}</p>
            <p className="mt-3 text-xs text-ink-faint">{t('family.health.notice')}</p>
          </Card>
        </Section>
      ) : null}

      <GoldRule />

      {/* WOW 4 — Matching -------------------------------------------------- */}
      <Section>
        <SectionTitle>{t('matching.title')}</SectionTitle>
        {matches.length === 0 ? (
          <EmptyState title={t('matching.empty')} hint={t('matching.empty.hint')} />
        ) : (
          <div className="space-y-3">
            {matches.slice(0, 6).map((candidate) => (
              <MatchCard
                key={candidate.caregiver.id}
                caseId={careCase.id}
                caregiverId={candidate.caregiver.id}
                caregiverName={caregiverName(candidate.caregiver)}
                subtitle={[
                  candidate.caregiver.experience_years
                    ? t('caregiver.years', { count: candidate.caregiver.experience_years })
                    : null,
                  candidate.caregiver.german_level !== null
                    ? t(germanLevelKey(candidate.caregiver.german_level))
                    : null,
                  candidate.caregiver.available_from
                    ? formatDate(candidate.caregiver.available_from)
                    : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                score={candidate.score}
                confidence={candidate.confidence}
                reasons={candidate.reasons}
                alreadyProposed={proposedIds.has(candidate.caregiver.id)}
                onPropose={proposeCandidateAction}
              />
            ))}
          </div>
        )}
      </Section>

      {placements.length > 0 ? (
        <Section>
          <SectionTitle>{t('placements.title')}</SectionTitle>
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
        </Section>
      ) : null}
    </Screen>
  )
}
