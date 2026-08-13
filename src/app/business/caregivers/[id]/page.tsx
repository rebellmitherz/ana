import { Phone } from 'lucide-react'
import { notFound } from 'next/navigation'

import { formatDate } from '@/core/i18n'
import { pageContext } from '@/modules/app/context'
import { caregiverAge, caregiverName, completeness, getCaregiver } from '@/modules/caregivers/service'
import { askAboutFieldAction, saveCaregiverFieldsAction } from '@/modules/caregivers/actions'
import { describeDraft, SKILL_OPTIONS } from '@/modules/assistant/describe'
import { listNotes } from '@/modules/tasks/service'
import { listPlacements } from '@/modules/placements/service'
import { Screen, ScreenHeader, Section } from '@/ui/layout'
import { Card, Chip, SectionTitle } from '@/ui/primitives'
import { EntityDetail } from '@/ui/patterns/entity-detail'
import { PlacementCard } from '@/ui/patterns/entity-cards'

export const dynamic = 'force-dynamic'

export default async function CaregiverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, t } = await pageContext()

  const caregiver = await getCaregiver(session, id)
  if (!caregiver) notFound()

  const [notes, placements] = await Promise.all([
    listNotes(session, { ownerKind: 'caregiver', ownerId: id, limit: 10 }),
    listPlacements(session),
  ])

  const own = placements.filter((entry) => entry.placement.caregiver_id === id)
  const percent = completeness(caregiver)
  const age = caregiverAge(caregiver)

  // Dieselbe Feldbeschreibung wie in der Bestätigungskarte — ein Muster,
  // eine Geste, kein zweites Formularmodell.
  const description = describeDraft(
    'createCaregiverDraft',
    caregiver as unknown as Record<string, unknown>,
    [],
    ['german_level', 'experience_years', 'available_from', 'skills', 'phone', 'birth_year', 'driver_license'],
  )

  return (
    <Screen>
      <ScreenHeader
        title={caregiverName(caregiver)}
        subtitle={[age ? String(age) : null, caregiver.city].filter(Boolean).join(' · ') || undefined}
        backHref="/business?tab=caregivers"
        backLabel={t('business.tab.caregivers')}
      />

      <Section>
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={caregiver.status === 'available' ? 'positive' : 'neutral'}>
            {t(`caregiver.status.${caregiver.status}` as never)}
          </Chip>
          {caregiver.available_from ? (
            <Chip tone="gold">{formatDate(caregiver.available_from)}</Chip>
          ) : null}
          {caregiver.phone ? (
            <a
              href={`tel:${caregiver.phone.replace(/\s/g, '')}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-paper-sunken px-3 py-1 text-[0.8rem] text-ink-soft transition-colors hover:text-alubali"
            >
              <Phone className="size-3" />
              {caregiver.phone}
            </a>
          ) : null}
        </div>

        {percent < 100 ? (
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-ink-faint">
              <span>{t('caregiver.completeness', { percent })}</span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-paper-sunken">
              <div
                className="h-full rounded-full bg-gold transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        ) : null}
      </Section>

      <Section>
        <EntityDetail
          fields={description.fields}
          entityId={caregiver.id}
          onSave={saveCaregiverFieldsAction}
          skillOptions={SKILL_OPTIONS}
          missingTitle="caregiver.missing"
          onAsk={async (entityId, label) => {
            'use server'
            await askAboutFieldAction(entityId, caregiverName(caregiver), label)
          }}
        />
      </Section>

      {own.length > 0 ? (
        <Section>
          <SectionTitle>{t('placements.title')}</SectionTitle>
          <div className="space-y-2.5">
            {own.map((entry) => (
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

      {notes.length > 0 ? (
        <Section>
          <SectionTitle>{t('caregiver.field.notes')}</SectionTitle>
          <div className="space-y-2">
            {notes.map((note) => (
              <Card key={note.id} className="p-4">
                <p className="text-georgian text-[0.95rem] text-ink-soft">{note.body}</p>
                <p className="mt-2 text-xs text-ink-faint">{formatDate(note.created_at)}</p>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}
    </Screen>
  )
}
