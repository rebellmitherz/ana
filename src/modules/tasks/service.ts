import 'server-only'

import { getScopedStore } from '@/core/db'
import type { EntityKind, Id, NoteRow, TaskRow } from '@/core/db/types'
import type { Session } from '@/core/auth/session'

export async function listTasks(
  session: Session,
  filter: { status?: TaskRow['status'] } = {},
): Promise<TaskRow[]> {
  const store = await getScopedStore(session.orgId)
  const rows = await store.list('tasks', {
    where: filter.status ? { status: filter.status } : undefined,
    orderBy: { column: 'due_at', ascending: true },
  })
  // Aufgaben ohne Fälligkeit hinten einsortieren.
  return [...rows].sort((a, b) => {
    if (!a.due_at && !b.due_at) return 0
    if (!a.due_at) return 1
    if (!b.due_at) return -1
    return a.due_at.localeCompare(b.due_at)
  })
}

export async function createTask(
  session: Session,
  input: {
    title: string
    detail?: string | null
    dueAt?: string | null
    relatedKind?: EntityKind | null
    relatedId?: Id | null
    source?: TaskRow['source']
  },
  options: { isDemo?: boolean } = {},
): Promise<TaskRow> {
  const store = await getScopedStore(session.orgId)
  return store.insert('tasks', {
    title: input.title,
    detail: input.detail ?? null,
    due_at: input.dueAt ? new Date(`${input.dueAt}T09:00:00`).toISOString() : null,
    status: 'open',
    source: input.source ?? 'manual',
    related_kind: input.relatedKind ?? null,
    related_id: input.relatedId ?? null,
    done_at: null,
    is_demo: options.isDemo ?? false,
  })
}

export async function completeTask(session: Session, id: Id): Promise<void> {
  const store = await getScopedStore(session.orgId)
  await store.update('tasks', id, { status: 'done', done_at: new Date().toISOString() })
}

export async function reopenTask(session: Session, id: Id): Promise<void> {
  const store = await getScopedStore(session.orgId)
  await store.update('tasks', id, { status: 'open', done_at: null })
}

// ---------------------------------------------------------------------------

export async function createNote(
  session: Session,
  input: {
    body: string
    bodyLang?: string
    ownerKind?: EntityKind | null
    ownerId?: Id | null
    recordingId?: Id | null
    source?: NoteRow['source']
  },
  options: { isDemo?: boolean } = {},
): Promise<NoteRow> {
  const store = await getScopedStore(session.orgId)
  return store.insert('notes', {
    owner_kind: input.ownerKind ?? null,
    owner_id: input.ownerId ?? null,
    body: input.body,
    body_lang: input.bodyLang ?? 'ka',
    source: input.source ?? 'manual',
    recording_id: input.recordingId ?? null,
    is_demo: options.isDemo ?? false,
  })
}

export async function listNotes(
  session: Session,
  filter: { ownerKind?: EntityKind; ownerId?: Id; limit?: number } = {},
): Promise<NoteRow[]> {
  const store = await getScopedStore(session.orgId)
  return store.list('notes', {
    where:
      filter.ownerKind && filter.ownerId
        ? { owner_kind: filter.ownerKind, owner_id: filter.ownerId }
        : undefined,
    orderBy: { column: 'created_at', ascending: false },
    limit: filter.limit ?? 50,
  })
}
