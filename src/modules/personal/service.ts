import 'server-only'

import { getScopedStore } from '@/core/db'
import type { Id, PersonalCategory, PersonalItemRow } from '@/core/db/types'
import type { Session } from '@/core/auth/session'

/**
 * ჩემი — der persönliche Bereich.
 *
 * Er hat keinen Geschäftsnutzen. Er ist der Grund, warum die App sich wie ein
 * Geschenk anfühlt und nicht wie ein Werkzeug. Deshalb: kein Status, kein
 * Workflow, kein Business-Vokabular. Nur „+".
 */

export const PERSONAL_CATEGORIES: PersonalCategory[] = [
  'favorites',
  'wishlist',
  'restaurant',
  'beauty',
]

export async function listPersonalItems(
  session: Session,
  category?: PersonalCategory,
): Promise<PersonalItemRow[]> {
  const store = await getScopedStore(session.orgId)
  const rows = await store.list('personal_items', {
    where: category ? { category } : undefined,
    orderBy: { column: 'position', ascending: true },
  })
  return rows
}

export async function createPersonalItem(
  session: Session,
  input: {
    category: PersonalCategory
    title: string
    note?: string | null
    url?: string | null
    priceEur?: number | null
    isLocked?: boolean
  },
  options: { isDemo?: boolean } = {},
): Promise<PersonalItemRow> {
  const store = await getScopedStore(session.orgId)
  const existing = await store.list('personal_items', { where: { category: input.category } })

  return store.insert('personal_items', {
    category: input.category,
    title: input.title,
    note: input.note ?? null,
    url: input.url ?? null,
    price_eur: input.priceEur ?? null,
    is_favorite: false,
    is_locked: input.isLocked ?? false,
    position: existing.length,
    is_demo: options.isDemo ?? false,
  })
}

export async function toggleFavorite(session: Session, id: Id): Promise<void> {
  const store = await getScopedStore(session.orgId)
  const item = await store.get('personal_items', id)
  if (!item) return
  await store.update('personal_items', id, { is_favorite: !item.is_favorite })
}

export async function deletePersonalItem(session: Session, id: Id): Promise<void> {
  const store = await getScopedStore(session.orgId)
  const item = await store.get('personal_items', id)
  // Ein Eintrag ist bewusst nicht löschbar. Sie wird es irgendwann merken. 🍒
  if (!item || item.is_locked) return
  await store.softDelete('personal_items', id)
}
