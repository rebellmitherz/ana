import 'server-only'

import { cookies } from 'next/headers'

import { env } from '@/core/config/env'
import { DEFAULT_LOCALE, resolveLocale, type Locale } from '@/core/i18n'
import { createSupabaseClient } from '@/core/db/supabase-store'

/**
 * Sitzungskontext. Jeder Service bekommt ihn als erstes Argument — er ist die
 * Mandanten- und Rollengrenze der Anwendung.
 */
export interface Session {
  userId: string
  orgId: string
  displayName: string
  locale: Locale
  role: 'owner' | 'staff'
  /**
   * True, wenn ohne Supabase gearbeitet wird. Dann existiert genau eine
   * Organisation, ein Nutzer und ein lokaler Datenspeicher.
   */
  isDemo: boolean
}

export const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001'
export const DEMO_ORG_ID = '00000000-0000-4000-8000-000000000010'

export const COOKIE_NAME = 'alubali_name'
export const COOKIE_LOCALE = 'alubali_locale'
export const COOKIE_ONBOARDED = 'alubali_onboarded'

/**
 * Liefert die aktive Sitzung, oder `null`, wenn eine Anmeldung nötig ist.
 *
 * Im Demo-Modus gibt es immer eine Sitzung — die App ist sofort benutzbar.
 */
export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const locale = resolveLocale(cookieStore.get(COOKIE_LOCALE)?.value)
  const storedName = cookieStore.get(COOKIE_NAME)?.value

  if (!env.supabase.configured) {
    return {
      userId: DEMO_USER_ID,
      orgId: DEMO_ORG_ID,
      displayName: storedName ? decodeURIComponent(storedName) : '',
      locale,
      role: 'owner',
      isDemo: true,
    }
  }

  const client = await createSupabaseClient()
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) return null

  const metadata = data.user.user_metadata as { full_name?: string; name?: string } | null
  const name = storedName
    ? decodeURIComponent(storedName)
    : (metadata?.full_name ?? metadata?.name ?? '')

  // V1: eine Organisation pro Nutzerin. Die Mitgliedschaftstabelle existiert im
  // Schema und wird aktiviert, sobald es einen zweiten Nutzer gibt.
  return {
    userId: data.user.id,
    orgId: data.user.id,
    displayName: name,
    locale,
    role: 'owner',
    isDemo: false,
  }
}

/** Wie `getSession`, wirft aber statt `null` zu liefern. Für Server Actions. */
export async function requireSession(): Promise<Session> {
  const session = await getSession()
  if (!session) throw new UnauthorizedError()
  return session
}

export class UnauthorizedError extends Error {
  constructor() {
    super('Nicht angemeldet')
    this.name = 'UnauthorizedError'
  }
}

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies()
  return resolveLocale(cookieStore.get(COOKIE_LOCALE)?.value ?? DEFAULT_LOCALE)
}

export async function hasCompletedOnboarding(): Promise<boolean> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_ONBOARDED)?.value === '1'
}
