import 'server-only'

import { getScopedStore } from '@/core/db'
import type { CareCaseRow, FamilyRow, Id } from '@/core/db/types'
import type { Session } from '@/core/auth/session'
import { diffFields, recordAudit } from '@/modules/audit'

/**
 * Familien und Pflegefälle.
 *
 * Die Familie ist die Kontakt- und Vertragspartei. Der Pflegefall ist die zu
 * betreuende Person mit ihren Anforderungen. Eine Familie kann mehrere Fälle
 * haben, ein Fall überlebt viele Rotationen — deshalb sind es zwei Entitäten.
 *
 * Freitext-Diagnosen liegen in `care_case_health`: eigene Zeile, eigene
 * Zugriffsregel, kein Audit-Wertdiff (Art. 9 DSGVO).
 */

export interface CaseWithFamily {
  careCase: CareCaseRow
  family: FamilyRow
}

const CASE_DEFAULTS = {
  patient_first_name: null,
  patient_birth_year: null,
  care_level: null,
  mobility: null,
  dementia: null,
  living_situation: null,
  has_pets: null,
  own_room: null,
  night_work_required: false,
  driver_license_required: false,
  smoking_allowed: false,
  required_german_level: null,
  tasks: [],
  start_date: null,
  expected_months: null,
  budget_eur: null,
  notes: null,
} satisfies Partial<CareCaseRow>

export function patientAge(row: CareCaseRow): number | null {
  return row.patient_birth_year ? new Date().getFullYear() - row.patient_birth_year : null
}

// ---------------------------------------------------------------------------

export async function listFamilies(session: Session): Promise<FamilyRow[]> {
  const store = await getScopedStore(session.orgId)
  return store.list('families', { orderBy: { column: 'created_at', ascending: false } })
}

export async function listCases(session: Session): Promise<CaseWithFamily[]> {
  const store = await getScopedStore(session.orgId)
  const [cases, families] = await Promise.all([
    store.list('care_cases', { orderBy: { column: 'created_at', ascending: false } }),
    store.list('families'),
  ])

  const byId = new Map(families.map((family) => [family.id, family]))
  return cases
    .map((careCase) => {
      const family = byId.get(careCase.family_id)
      return family ? { careCase, family } : null
    })
    .filter((entry): entry is CaseWithFamily => entry !== null)
}

export async function getCase(session: Session, id: Id): Promise<CaseWithFamily | null> {
  const store = await getScopedStore(session.orgId)
  const careCase = await store.get('care_cases', id)
  if (!careCase) return null
  const family = await store.get('families', careCase.family_id)
  return family ? { careCase, family } : null
}

export async function getCaseHealth(session: Session, caseId: Id): Promise<string | null> {
  // Nur die Inhaberin sieht Art.-9-Daten. Im MVP ist das immer die Nutzerin,
  // die Prüfung steht trotzdem hier — sie ist die Stelle, die später zählt.
  if (session.role !== 'owner') return null

  const store = await getScopedStore(session.orgId)
  const rows = await store.list('care_case_health', { where: { care_case_id: caseId }, limit: 1 })
  return rows[0]?.diagnoses ?? null
}

/**
 * Legt Familie, Fall und (falls genannt) Gesundheitsdaten in einem Schritt an.
 * Das ist die Einheit, die die Nutzerin gedanklich hat — sie erfasst "eine
 * Familie", nicht drei Tabellenzeilen.
 */
export async function createFamilyWithCase(
  session: Session,
  input: {
    family: Partial<FamilyRow> & { contact_name: string }
    careCase?: Partial<CareCaseRow>
    diagnoses?: string | null
  },
  options: { isDemo?: boolean } = {},
): Promise<CaseWithFamily> {
  const store = await getScopedStore(session.orgId)
  const isDemo = options.isDemo ?? false

  const family = await store.insert('families', {
    relation: null,
    phone: null,
    email: null,
    city: null,
    postal_code: null,
    notes: null,
    ...input.family,
    is_demo: isDemo,
  })

  const careCase = await store.insert('care_cases', {
    ...CASE_DEFAULTS,
    ...input.careCase,
    family_id: family.id,
    status: input.careCase?.status ?? 'new',
    is_demo: isDemo,
  })

  if (input.diagnoses) {
    await store.insert('care_case_health', {
      care_case_id: careCase.id,
      diagnoses: input.diagnoses,
      medication: null,
      special_care_notes: null,
      is_demo: isDemo,
    })
  }

  await recordAudit(session, { table: 'families', rowId: family.id, op: 'INSERT' })
  await recordAudit(session, { table: 'care_cases', rowId: careCase.id, op: 'INSERT' })

  return { careCase, family }
}

export async function updateCase(
  session: Session,
  id: Id,
  patch: Partial<CareCaseRow>,
): Promise<CareCaseRow> {
  const store = await getScopedStore(session.orgId)
  const before = await store.get('care_cases', id)
  if (!before) throw new Error('Fall nicht gefunden')

  const row = await store.update('care_cases', id, patch)
  await recordAudit(session, {
    table: 'care_cases',
    rowId: id,
    op: 'UPDATE',
    changed: diffFields(before as unknown as Record<string, unknown>, patch),
  })
  return row
}

export async function updateFamily(
  session: Session,
  id: Id,
  patch: Partial<FamilyRow>,
): Promise<FamilyRow> {
  const store = await getScopedStore(session.orgId)
  const before = await store.get('families', id)
  if (!before) throw new Error('Familie nicht gefunden')

  const row = await store.update('families', id, patch)
  await recordAudit(session, {
    table: 'families',
    rowId: id,
    op: 'UPDATE',
    changed: diffFields(before as unknown as Record<string, unknown>, patch),
  })
  return row
}

export async function deleteCase(session: Session, id: Id): Promise<void> {
  const store = await getScopedStore(session.orgId)
  await store.softDelete('care_cases', id)
  await recordAudit(session, { table: 'care_cases', rowId: id, op: 'DELETE' })
}
