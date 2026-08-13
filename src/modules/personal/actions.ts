'use server'

import { revalidatePath } from 'next/cache'

import type { PersonalCategory } from '@/core/db/types'
import { actionContext } from '@/modules/app/context'
import { createPersonalItem, deletePersonalItem, toggleFavorite } from './service'

const CATEGORIES: PersonalCategory[] = ['favorites', 'wishlist', 'restaurant', 'beauty']

export async function addPersonalItemAction(formData: FormData): Promise<void> {
  const { session } = await actionContext()

  const title = String(formData.get('title') ?? '').trim()
  if (title.length === 0) return

  const rawCategory = String(formData.get('category') ?? 'wishlist')
  const category = CATEGORIES.includes(rawCategory as PersonalCategory)
    ? (rawCategory as PersonalCategory)
    : 'wishlist'

  const priceRaw = String(formData.get('price') ?? '').trim()
  const price = priceRaw ? Number(priceRaw) : null

  await createPersonalItem(session, {
    category,
    title,
    note: String(formData.get('note') ?? '').trim() || null,
    url: String(formData.get('url') ?? '').trim() || null,
    priceEur: price !== null && Number.isFinite(price) ? price : null,
  })

  revalidatePath('/me')
}

export async function toggleFavoriteAction(itemId: string): Promise<void> {
  const { session } = await actionContext()
  await toggleFavorite(session, itemId)
  revalidatePath('/me')
}

export async function deletePersonalItemAction(itemId: string): Promise<void> {
  const { session } = await actionContext()
  await deletePersonalItem(session, itemId)
  revalidatePath('/me')
}
