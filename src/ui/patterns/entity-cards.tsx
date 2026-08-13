import { Link2Off } from 'lucide-react'

import { formatDate, germanLevelKey, type Translator } from '@/core/i18n'
import type { CareCaseRow, CaregiverRow, FamilyRow, PlacementRow } from '@/core/db/types'
import { caregiverAge, caregiverName, completeness } from '@/modules/caregivers/service'
import { patientAge } from '@/modules/families/service'
import { CardLink, Chip } from '@/ui/primitives'

/**
 * Listeneinträge.
 *
 * Jede Karte beantwortet in einem Blick die eine Frage, die im jeweiligen
 * Kontext zählt — bei Pflegerinnen „ab wann und was kann sie", bei Fällen
 * „ab wann und wie dringend". Keine Tabellenspalten, keine IDs, keine Icons
 * ohne Bedeutung.
 */

function Initials({ name, tone = 'accent' }: { name: string; tone?: 'accent' | 'gold' }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')

  return (
    <span
      className={`flex size-12 shrink-0 items-center justify-center rounded-full font-display text-[1rem] ${
        tone === 'accent' ? 'bg-alubali-soft text-alubali' : 'bg-gold-soft text-gold-deep'
      }`}
    >
      {initials || '—'}
    </span>
  )
}

export function CaregiverCard({ row, t }: { row: CaregiverRow; t: Translator }) {
  const age = caregiverAge(row)
  const percent = completeness(row)

  return (
    <CardLink href={`/business/caregivers/${row.id}`} className="flex items-center gap-4 p-4">
      <Initials name={caregiverName(row)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-display text-[1.1rem] text-ink">
            {caregiverName(row)}
          </span>
          {age ? <span className="shrink-0 text-sm text-ink-faint">{age}</span> : null}
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {row.german_level !== null ? (
            <Chip tone="neutral">{t(germanLevelKey(row.german_level))}</Chip>
          ) : null}
          {row.experience_years !== null ? (
            <Chip tone="neutral">{t('caregiver.years', { count: row.experience_years })}</Chip>
          ) : null}
          {row.skills.slice(0, 2).map((skill) => (
            <Chip key={skill} tone="accent">
              {t(`skill.${skill}` as never)}
            </Chip>
          ))}
        </div>

        <p className="mt-1.5 text-xs text-ink-faint">
          {row.available_from
            ? new Date(row.available_from) <= new Date()
              ? t('caregiver.availableNow')
              : t('caregiver.availableFrom', { date: formatDate(row.available_from) })
            : percent < 50
              ? t('caregiver.completeness', { percent })
              : t(`caregiver.status.${row.status}` as never)}
        </p>
      </div>
    </CardLink>
  )
}

export function CaseCard({
  careCase,
  family,
  t,
  proposalCount,
}: {
  careCase: CareCaseRow
  family: FamilyRow
  t: Translator
  proposalCount?: number
}) {
  const age = patientAge(careCase)

  return (
    <CardLink href={`/business/cases/${careCase.id}`} className="flex items-center gap-4 p-4">
      <Initials name={family.contact_name} tone="gold" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-display text-[1.1rem] text-ink">
            {family.contact_name}
          </span>
          {proposalCount === 0 ? (
            <Chip tone="caution">
              <Link2Off className="size-3" />
            </Chip>
          ) : null}
        </div>

        <p className="mt-0.5 truncate text-sm text-ink-muted">
          {[careCase.patient_first_name, age ? `${age}` : null, family.city]
            .filter(Boolean)
            .join(' · ')}
        </p>

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <Chip tone="neutral">{t(`family.status.${careCase.status}` as never)}</Chip>
          {careCase.start_date ? (
            <span className="text-xs text-ink-faint">{formatDate(careCase.start_date)}</span>
          ) : null}
        </div>
      </div>
    </CardLink>
  )
}

export function PlacementCard({
  placement,
  caregiver,
  family,
  t,
}: {
  placement: PlacementRow
  caregiver: CaregiverRow | null
  family: FamilyRow | null
  t: Translator
}) {
  const tone =
    placement.status === 'active'
      ? 'positive'
      : placement.status === 'proposed'
        ? 'gold'
        : placement.status === 'declined' || placement.status === 'cancelled'
          ? 'critical'
          : 'neutral'

  return (
    <CardLink href={`/business/placements/${placement.id}`} className="p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate font-display text-[1.05rem] text-ink">
          {caregiver ? caregiverName(caregiver) : '—'}
        </span>
        <Chip tone={tone}>{t(`placement.status.${placement.status}` as never)}</Chip>
      </div>
      <p className="mt-1 truncate text-sm text-ink-muted">{family?.contact_name ?? '—'}</p>
      <div className="mt-2 flex items-center gap-3 text-xs text-ink-faint">
        {placement.start_date ? <span>{formatDate(placement.start_date)}</span> : null}
        {placement.match_score !== null ? (
          <span className="text-alubali">{placement.match_score}%</span>
        ) : null}
      </div>
    </CardLink>
  )
}
