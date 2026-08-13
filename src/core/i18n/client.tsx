'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'

import { DEFAULT_LOCALE, getTranslator, type Locale, type Translator } from './index'

/**
 * Übersetzungen für Client-Komponenten.
 *
 * Das gesamte Wörterbuch der aktiven Sprache geht einmal an den Client (~12 kB).
 * Alternative wäre, jeder interaktiven Komponente ihre Strings als Props zu
 * reichen — das wäre bei einer sprachgesteuerten App unübersichtlich und
 * fehleranfällig. Der Kompromiss ist bewusst gewählt.
 */

interface I18nValue {
  locale: Locale
  t: Translator
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  const value = useMemo<I18nValue>(() => ({ locale, t: getTranslator(locale) }), [locale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext)
  if (!value) {
    // Kein Absturz während der Hydration — Default statt Fehler.
    return { locale: DEFAULT_LOCALE, t: getTranslator(DEFAULT_LOCALE) }
  }
  return value
}

export function useT(): Translator {
  return useI18n().t
}
