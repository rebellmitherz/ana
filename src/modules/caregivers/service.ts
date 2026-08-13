import 'server-only'

import { getScopedStore } from '@/core/db'
import type { CaregiverRow, Id, SkillKey } from '@/core/db/types'
import type { Session } from '@/core/auth/session'
import { diffFields, recordAudit } from '@/modules/audit'

/**
 * Pflegerinnen.
 *
 * Grundhaltung: Kein Feld ist Pflicht. Ein Profil mit nur "Nino, Demenz, ab
 * September" ist ein gültiges Profil. Vollständigkeit ist ein Fortschritt und
 * erzeugt Fragen — sie ist kein Tor.
 */

export type CaregiverInput = Partial<Omit<CaregiverRow, keyof BaseFields>> & {
  first_name: string
}

type BaseFields = {
  id: Id
  org_id: Id
  created_at: string
  updated_at: string
  is_demo: boolean
  deleted_at: string | null
}

const DEFAULTS = {
  last_name: null,
  birth_year: null,
  phone: null,
  whatsapp: null,
  city: null,
  country: 'GE',
  german_level: null,
  languages: [],
  experience_years: null,
  skills: [],
  driver_license: null,
  smoker: null,
  night_work: null,
  cooking: null,
  available_from: null,
  rotation_weeks: null,
  desired_salary_eur: null,
  photo_path: null,
  notes: null,
} satisfies Partial<CaregiverRow>

/** Felder, die ein Profil vermittelbar machen. Steuert Fortschritt und Rückfragen. */
export const COMPLETENESS_FIELDS = [
  'german_level',
  'experience_years',
  'available_from',
  'skills',
  'phone',
  'birth_year',
  'driver_license',
  'rotation_weeks',
] as const satisfies readonly (keyof CaregiverRow)[]

export function missingFields(row: CaregiverRow): (keyof CaregiverRow)[] {
  return COMPLETENESS_FIELDS.filter((field) => {
    const value = row[field]
    if (Array.isArray(value)) return value.length === 0
    return value === null || value === undefined
  })
}

export function completeness(row: CaregiverRow): number {
  const missing = missingFields(row).length
  return Math.round(((COMPLETENESS_FIELDS.length - missing) / COMPLETENESS_FIELDS.length) * 100)
}

export function caregiverAge(row: CaregiverRow): number | null {
  return row.birth_year ? new Date().getFullYear() - row.birth_year : null
}

export function caregiverName(row: CaregiverRow): string {
  return [row.first_name, row.last_name].filter(Boolean).join(' ')
}

/** Ein Profil unter 50 % gilt als unvollständig — sichtbar, aber nicht blockierend. */
function deriveStatus(row: Partial<CaregiverRow>, current?: CaregiverRow): CaregiverRow['status'] {
  if (current && ['placed', 'committed', 'paused', 'archived'].includes(current.status)) {
    return current.status
  }
  const merged = { ...DEFAULTS, ...current, ...row } as CaregiverRow
  return completeness(merged) < 50 ? 'incomplete' : 'available'
}

// ---------------------------------------------------------------------------

export async function listCaregivers(
  session: Session,
  filter: { search?: string; status?: CaregiverRow['status'][] } = {},
): Promise<CaregiverRow[]> {
  const store = await getScopedStore(session.orgId)
  const rows = await store.list('caregivers', {
    where: filter.status ? { status: filter.status } : undefined,
    orderBy: { column: 'created_at', ascending: false },
  })

  if (!filter.search?.trim()) return rows
  const needle = filter.search.trim().toLowerCase()
  return rows.filter((row) => caregiverName(row).toLowerCase().includes(needle))
}

export async function getCaregiver(session: Session, id: Id): Promise<CaregiverRow | null> {
  const store = await getScopedStore(session.orgId)
  return store.get('caregivers', id)
}

export async function createCaregiver(
  session: Session,
  input: CaregiverInput,
  options: { isDemo?: boolean } = {},
): Promise<CaregiverRow> {
  const store = await getScopedStore(session.orgId)

  const row = await store.insert('caregivers', {
    ...DEFAULTS,
    ...input,
    status: input.status ?? deriveStatus(input),
    is_demo: options.isDemo ?? false,
  })

  await recordAudit(session, { table: 'caregivers', rowId: row.id, op: 'INSERT' })
  return row
}

export async function updateCaregiver(
  session: Session,
  id: Id,
  patch: Partial<CaregiverRow>,
): Promise<CaregiverRow> {
  const store = await getScopedStore(session.orgId)
  const before = await store.get('caregivers', id)
  if (!before) throw new Error('Pflegerin nicht gefunden')

  const next = { ...patch, status: patch.status ?? deriveStatus(patch, before) }
  const row = await store.update('caregivers', id, next)

  await recordAudit(session, {
    table: 'caregivers',
    rowId: id,
    op: 'UPDATE',
    changed: diffFields(before as unknown as Record<string, unknown>, next),
  })
  return row
}

export async function deleteCaregiver(session: Session, id: Id): Promise<void> {
  const store = await getScopedStore(session.orgId)
  await store.softDelete('caregivers', id)
  await recordAudit(session, { table: 'caregivers', rowId: id, op: 'DELETE' })
}

export async function toggleSkill(
  session: Session,
  id: Id,
  skill: SkillKey,
): Promise<CaregiverRow> {
  const current = await getCaregiver(session, id)
  if (!current) throw new Error('Pflegerin nicht gefunden')

  const skills = current.skills.includes(skill)
    ? current.skills.filter((s) => s !== skill)
    : [...current.skills, skill]

  return updateCaregiver(session, id, { skills })
}

/** Namen für den STT-Bias — der billigste Qualitätshebel im ganzen System. */
export async function vocabularyForSpeech(session: Session): Promise<string[]> {
  const store = await getScopedStore(session.orgId)
  const [caregivers, families] = await Promise.all([
    store.list('caregivers', { limit: 100 }),
    store.list('families', { limit: 100 }),
  ])

  return [
    ...caregivers.flatMap((row) => [row.first_name, row.last_name].filter(Boolean)),
    ...families.map((row) => row.contact_name),
  ].filter((value): value is string => Boolean(value))
}
