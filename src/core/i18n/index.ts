import { ka, type MessageKey } from './messages/ka'
import { de } from './messages/de'

export const LOCALES = ['ka', 'de'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'ka'

export type { MessageKey }

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { ka, de }

export type TranslateParams = Record<string, string | number>

/** Eine gebundene Übersetzungsfunktion. */
export type Translator = (key: MessageKey, params?: TranslateParams) => string

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name]
    return value === undefined ? match : String(value)
  })
}

export function getTranslator(locale: Locale): Translator {
  const dict = DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE]
  return (key, params) => interpolate(dict[key] ?? key, params)
}

export function isLocale(value: string | undefined): value is Locale {
  return value !== undefined && (LOCALES as readonly string[]).includes(value)
}

export function resolveLocale(value: string | undefined): Locale {
  return isLocale(value) ? value : DEFAULT_LOCALE
}

/**
 * Datums- und Zahlenformate folgen bewusst der deutschen Konvention (01.09.2026),
 * unabhängig von der UI-Sprache: Sie lebt in Deutschland und alle Dokumente,
 * Termine und Verträge um sie herum verwenden dieses Format.
 */
const DATE_LOCALE = 'de-DE'

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

export function formatDateLong(value: string | Date | null | undefined): string {
  if (!value) return '—'
  const date = typeof value === 'string' ? new Date(value) : value
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat(DATE_LOCALE, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat(DATE_LOCALE, {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(value)
}

/** Deutschniveau 0–6 → Label ('A2', 'B1', …). */
export function germanLevelKey(level: number | null | undefined): MessageKey {
  const clamped = Math.min(6, Math.max(0, level ?? 0))
  return `german.${clamped}` as MessageKey
}
