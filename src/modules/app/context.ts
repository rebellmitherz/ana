import 'server-only'

import { redirect } from 'next/navigation'

import { env } from '@/core/config/env'
import { getSession, type Session } from '@/core/auth/session'
import { getTranslator, type Locale, type Translator } from '@/core/i18n'
import { isStoreEmpty, seedDemoData } from '@/modules/demo/seed'

/**
 * Einstiegspunkt jeder Seite: Sitzung, Sprache, Übersetzer.
 *
 * Legt beim allerersten Aufruf die Demo-Daten an. Grund: Eine leere App kann
 * beim ersten Öffnen nichts beweisen — und genau dieser Moment entscheidet,
 * ob sie die App noch einmal öffnet.
 */

export interface PageContext {
  session: Session
  locale: Locale
  t: Translator
}

let seedPromise: Promise<void> | null = null

async function ensureSeeded(session: Session): Promise<void> {
  if (!env.app.seedDemoData) return
  // Nur einmal pro Prozess versuchen — parallele Seitenaufrufe teilen sich
  // dieselbe Zusage, sonst entstehen doppelte Datensätze.
  seedPromise ??= (async () => {
    try {
      if (await isStoreEmpty(session)) await seedDemoData(session)
    } catch (error) {
      console.error('[bootstrap] Demo-Daten konnten nicht angelegt werden:', error)
    }
  })()
  await seedPromise
}

export async function pageContext(): Promise<PageContext> {
  const session = await getSession()
  if (!session) redirect('/auth')

  await ensureSeeded(session)

  return { session, locale: session.locale, t: getTranslator(session.locale) }
}

/** Wie `pageContext`, aber ohne Weiterleitung — für Server Actions. */
export async function actionContext(): Promise<PageContext> {
  const session = await getSession()
  if (!session) throw new Error('Nicht angemeldet')
  return { session, locale: session.locale, t: getTranslator(session.locale) }
}
