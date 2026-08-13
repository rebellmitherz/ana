import 'server-only'

import { getScopedStore } from '@/core/db'
import type { CaregiverRow, Id, PlacementRow } from '@/core/db/types'
import type { Session } from '@/core/auth/session'
import { getCase } from '@/modules/families/service'
import { recordAudit } from '@/modules/audit'

import { MATCHING_VERSION, rankCandidates, type CaregiverHistory, type MatchCandidate } from './score'

/**
 * Matching gegen die Datenbank.
 *
 * Der Score wird bei jedem Aufruf neu berechnet — ein gespeicherter Match
 * veraltet sofort, sobald eine Pflegerin woanders zusagt. Erst wenn tatsächlich
 * vorgeschlagen wird, friert `proposeCandidate` den Score als Snapshot am
 * Placement ein. Damit bleibt später nachvollziehbar, warum sie damals passte.
 */

async function loadHistories(
  session: Session,
  caregiverIds: Id[],
): Promise<Map<string, CaregiverHistory>> {
  const store = await getScopedStore(session.orgId)
  const placements = await store.list('placements', {
    where: { caregiver_id: caregiverIds },
  })

  const histories = new Map<string, CaregiverHistory>()
  for (const placement of placements) {
    const entry = histories.get(placement.caregiver_id) ?? { completed: 0, cancelled: 0 }
    if (placement.status === 'ended') entry.completed += 1
    if (placement.status === 'cancelled' || placement.status === 'declined') entry.cancelled += 1
    histories.set(placement.caregiver_id, entry)
  }
  return histories
}

export async function findMatches(session: Session, caseId: Id): Promise<MatchCandidate[]> {
  const store = await getScopedStore(session.orgId)
  const entry = await getCase(session, caseId)
  if (!entry) return []

  const caregivers = await store.list('caregivers')
  const histories = await loadHistories(
    session,
    caregivers.map((caregiver) => caregiver.id),
  )

  const candidates = rankCandidates(caregivers, entry.careCase, histories)

  // Bereits vorgeschlagene Kandidatinnen bleiben sichtbar, aber markiert.
  const existing = await store.list('placements', { where: { care_case_id: caseId } })
  const proposed = new Set(existing.map((placement) => placement.caregiver_id))

  return candidates.map((candidate) => ({
    ...candidate,
    caregiver: candidate.caregiver as CaregiverRow,
    alreadyProposed: proposed.has(candidate.caregiver.id),
  })) as (MatchCandidate & { alreadyProposed: boolean })[]
}

/**
 * Macht aus einem berechneten Vorschlag einen echten Vorgang.
 *
 * Hier — und nur hier — wird der Score persistiert: als eingefrorener Snapshot
 * inklusive Version des Algorithmus.
 */
export async function proposeCandidate(
  session: Session,
  caseId: Id,
  caregiverId: Id,
): Promise<PlacementRow> {
  const store = await getScopedStore(session.orgId)
  const entry = await getCase(session, caseId)
  if (!entry) throw new Error('Fall nicht gefunden')

  const caregiver = await store.get('caregivers', caregiverId)
  if (!caregiver) throw new Error('Pflegerin nicht gefunden')

  const histories = await loadHistories(session, [caregiverId])
  const [candidate] = rankCandidates([caregiver], entry.careCase, histories)
  if (!candidate) throw new Error('Kandidatin erfüllt die Grundbedingungen nicht')

  const now = new Date().toISOString()
  const placement = await store.insert('placements', {
    caregiver_id: caregiverId,
    care_case_id: caseId,
    status: 'proposed',
    match_score: candidate.score,
    match_confidence: candidate.confidence,
    match_reasons: candidate.reasons,
    match_breakdown: candidate.breakdown,
    matching_version: MATCHING_VERSION,
    snapshot_created_at: now,
    proposed_at: now,
    accepted_at: null,
    declined_reason: null,
    start_date: entry.careCase.start_date,
    end_date: null,
    compensation_eur: null,
    commission_eur: null,
    notes: null,
    is_demo: false,
  })

  // Statuswechsel passiert durch Handlung, nicht durch ein Dropdown.
  if (entry.careCase.status === 'new' || entry.careCase.status === 'needs_clarified' || entry.careCase.status === 'searching') {
    await store.update('care_cases', caseId, { status: 'proposed' })
  }
  if (caregiver.status === 'available' || caregiver.status === 'new') {
    await store.update('caregivers', caregiverId, { status: 'proposed' })
  }

  await recordAudit(session, { table: 'placements', rowId: placement.id, op: 'INSERT' })
  return placement
}
