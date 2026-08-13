import 'server-only'

import { getScopedStore } from '@/core/db'
import type { MessageKey } from '@/core/i18n'
import type { Session } from '@/core/auth/session'
import { caregiverName, completeness } from '@/modules/caregivers/service'

/**
 * „Heute" — was tatsächlich Aufmerksamkeit braucht.
 *
 * Bewusst kein Dashboard mit Kennzahlen. Die Frage ist nicht „wie läuft das
 * Geschäft", sondern „was muss ich heute anfassen". Alles hier ist ohne einen
 * einzigen AI-Aufruf berechnet.
 */

export type TodayBucket = 'overdue' | 'today' | 'soon' | 'attention'

export interface TodayItem {
  id: string
  bucket: TodayBucket
  labelKey: MessageKey
  params?: Record<string, string | number>
  /** Freitext (z. B. Aufgabentitel), wird statt des Labels angezeigt. */
  text?: string
  href?: string
  taskId?: string
  date?: string
}

const DAY = 86_400_000

function startOfToday(): number {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function bucketForDate(timestamp: number): TodayBucket | null {
  const today = startOfToday()
  if (timestamp < today) return 'overdue'
  if (timestamp < today + DAY) return 'today'
  if (timestamp < today + 7 * DAY) return 'soon'
  return null
}

export async function getTodayItems(session: Session): Promise<TodayItem[]> {
  const store = await getScopedStore(session.orgId)

  const [tasks, caregivers, cases, families, placements] = await Promise.all([
    store.list('tasks', { where: { status: 'open' } }),
    store.list('caregivers'),
    store.list('care_cases'),
    store.list('families'),
    store.list('placements'),
  ])

  const items: TodayItem[] = []
  const today = startOfToday()

  // --- Aufgaben ------------------------------------------------------------
  for (const task of tasks) {
    if (!task.due_at) continue
    const bucket = bucketForDate(new Date(task.due_at).getTime())
    if (!bucket) continue
    items.push({
      id: `task-${task.id}`,
      bucket,
      labelKey: 'today.item.taskDue',
      text: task.title,
      taskId: task.id,
      date: task.due_at,
    })
  }

  // --- Einsätze, die bald starten -----------------------------------------
  const caregiverById = new Map(caregivers.map((row) => [row.id, row]))
  for (const placement of placements) {
    if (placement.status !== 'accepted' || !placement.start_date) continue
    const start = new Date(`${placement.start_date}T00:00:00`).getTime()
    if (start < today || start > today + 14 * DAY) continue
    const caregiver = caregiverById.get(placement.caregiver_id)
    items.push({
      id: `placement-${placement.id}`,
      bucket: start < today + 7 * DAY ? 'soon' : 'attention',
      labelKey: 'today.item.placementStarting',
      params: { name: caregiver ? caregiverName(caregiver) : '—', date: placement.start_date },
      href: `/business/placements/${placement.id}`,
      date: placement.start_date,
    })
  }

  // --- Fälle ohne Vorschlag ------------------------------------------------
  const familyById = new Map(families.map((row) => [row.id, row]))
  const proposedCaseIds = new Set(placements.map((placement) => placement.care_case_id))
  for (const careCase of cases) {
    if (proposedCaseIds.has(careCase.id)) continue
    if (['completed', 'lost', 'active'].includes(careCase.status)) continue
    const family = familyById.get(careCase.family_id)
    items.push({
      id: `case-${careCase.id}`,
      bucket: 'attention',
      labelKey: 'today.item.caseWaiting',
      params: { name: family?.contact_name ?? '—' },
      href: `/business/cases/${careCase.id}`,
    })
  }

  // --- Pflegerinnen, die bald frei werden ----------------------------------
  for (const caregiver of caregivers) {
    if (!caregiver.available_from) continue
    if (!['available', 'new', 'paused'].includes(caregiver.status)) continue
    const free = new Date(`${caregiver.available_from}T00:00:00`).getTime()
    if (free <= today || free > today + 30 * DAY) continue
    items.push({
      id: `free-${caregiver.id}`,
      bucket: 'soon',
      labelKey: 'today.item.caregiverAvailable',
      params: { name: caregiverName(caregiver) },
      href: `/business/caregivers/${caregiver.id}`,
      date: caregiver.available_from,
    })
  }

  // --- Unvollständige Profile ---------------------------------------------
  for (const caregiver of caregivers) {
    if (caregiver.status === 'archived') continue
    if (completeness(caregiver) >= 50) continue
    items.push({
      id: `incomplete-${caregiver.id}`,
      bucket: 'attention',
      labelKey: 'today.item.incompleteProfile',
      params: { name: caregiverName(caregiver) },
      href: `/business/caregivers/${caregiver.id}`,
    })
  }

  const order: Record<TodayBucket, number> = { overdue: 0, today: 1, soon: 2, attention: 3 }
  return items.sort((a, b) => order[a.bucket] - order[b.bucket])
}

export function groupByBucket(items: TodayItem[]): [TodayBucket, TodayItem[]][] {
  const buckets: TodayBucket[] = ['overdue', 'today', 'soon', 'attention']
  return buckets
    .map((bucket) => [bucket, items.filter((item) => item.bucket === bucket)] as [TodayBucket, TodayItem[]])
    .filter(([, entries]) => entries.length > 0)
}
