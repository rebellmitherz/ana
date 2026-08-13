import 'server-only'

import { getScopedStore } from '@/core/db'
import type { CareCaseRow, CaregiverRow, FamilyRow, Id, PlacementRow, PlacementStatus } from '@/core/db/types'
import type { Session } from '@/core/auth/session'
import { recordAudit } from '@/modules/audit'

/**
 * Einsätze. Eine Rotation ist ein Placement — dieselbe Pflegerin im September
 * und wieder im März sind zwei Zeilen. Damit entstehen Historie, Auslastung
 * und Verlässlichkeit kostenlos aus dem Modell.
 */

export interface PlacementDetail {
  placement: PlacementRow
  caregiver: CaregiverRow | null
  careCase: CareCaseRow | null
  family: FamilyRow | null
}

export async function listPlacements(session: Session): Promise<PlacementDetail[]> {
  const store = await getScopedStore(session.orgId)
  const [placements, caregivers, cases, families] = await Promise.all([
    store.list('placements', { orderBy: { column: 'created_at', ascending: false } }),
    store.list('caregivers'),
    store.list('care_cases'),
    store.list('families'),
  ])

  const caregiverById = new Map(caregivers.map((row) => [row.id, row]))
  const caseById = new Map(cases.map((row) => [row.id, row]))
  const familyById = new Map(families.map((row) => [row.id, row]))

  return placements.map((placement) => {
    const careCase = caseById.get(placement.care_case_id) ?? null
    return {
      placement,
      caregiver: caregiverById.get(placement.caregiver_id) ?? null,
      careCase,
      family: careCase ? (familyById.get(careCase.family_id) ?? null) : null,
    }
  })
}

export async function listPlacementsForCase(
  session: Session,
  caseId: Id,
): Promise<PlacementDetail[]> {
  const all = await listPlacements(session)
  return all.filter((entry) => entry.placement.care_case_id === caseId)
}

export async function getPlacement(session: Session, id: Id): Promise<PlacementDetail | null> {
  const all = await listPlacements(session)
  return all.find((entry) => entry.placement.id === id) ?? null
}

/**
 * Statuswechsel. Zieht die abhängigen Zustände von Fall und Pflegerin mit —
 * die Nutzerin soll nie drei Status von Hand pflegen.
 */
export async function setPlacementStatus(
  session: Session,
  id: Id,
  status: PlacementStatus,
): Promise<PlacementRow> {
  const store = await getScopedStore(session.orgId)
  const placement = await store.get('placements', id)
  if (!placement) throw new Error('Einsatz nicht gefunden')

  const now = new Date().toISOString()
  const patch: Partial<PlacementRow> = { status }
  if (status === 'accepted') patch.accepted_at = now
  if (status === 'ended') patch.end_date = now.slice(0, 10)

  const updated = await store.update('placements', id, patch)

  const caregiverStatus: Partial<Record<PlacementStatus, CaregiverRow['status']>> = {
    accepted: 'committed',
    active: 'placed',
    ended: 'available',
    declined: 'available',
    cancelled: 'available',
  }
  const caseStatus: Partial<Record<PlacementStatus, CareCaseRow['status']>> = {
    accepted: 'confirmed',
    active: 'active',
    ended: 'completed',
    declined: 'searching',
  }

  const nextCaregiver = caregiverStatus[status]
  if (nextCaregiver) {
    await store.update('caregivers', placement.caregiver_id, { status: nextCaregiver })
  }
  const nextCase = caseStatus[status]
  if (nextCase) {
    await store.update('care_cases', placement.care_case_id, { status: nextCase })
  }

  await recordAudit(session, {
    table: 'placements',
    rowId: id,
    op: 'UPDATE',
    changed: { status: [placement.status, status] },
  })
  return updated
}
