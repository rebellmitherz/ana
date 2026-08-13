'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

import { COOKIE_NAME, COOKIE_ONBOARDED } from '@/core/auth/session'

const YEAR = 60 * 60 * 24 * 365

export async function saveNameAction(name: string): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, encodeURIComponent(name.trim().slice(0, 40)), {
    maxAge: YEAR,
    sameSite: 'lax',
    path: '/',
  })
  revalidatePath('/', 'layout')
}

export async function completeOnboardingAction(): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_ONBOARDED, '1', { maxAge: YEAR, sameSite: 'lax', path: '/' })
  revalidatePath('/', 'layout')
}
