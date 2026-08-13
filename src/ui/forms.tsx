'use client'

import { Check } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'
import { useId } from 'react'

import { cn } from './cn'

/**
 * Formularbausteine.
 *
 * Grundhaltung: Kein Feld ist Pflicht. Sie darf jederzeit ein halb ausgefülltes
 * Profil speichern — Vollständigkeit ist ein Fortschritt, kein Tor.
 */

const FIELD_BASE =
  'w-full rounded-control border border-line bg-paper-raised px-4 py-3 text-[1rem] text-ink ' +
  'placeholder:text-ink-faint transition-colors duration-200 ' +
  'focus:border-gold focus:outline-none'

function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-sm text-ink-muted">
      {children}
    </label>
  )
}

export function TextField({
  label,
  hint,
  className,
  ...props
}: { label: string; hint?: string } & ComponentProps<'input'>) {
  const id = useId()
  return (
    <div className="mb-4">
      <Label htmlFor={id}>{label}</Label>
      <input id={id} className={cn(FIELD_BASE, className)} {...props} />
      {hint ? <p className="mt-1.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

export function TextArea({
  label,
  hint,
  className,
  ...props
}: { label?: string; hint?: string } & ComponentProps<'textarea'>) {
  const id = useId()
  return (
    <div className="mb-4">
      {label ? <Label htmlFor={id}>{label}</Label> : null}
      <textarea
        id={id}
        rows={4}
        className={cn(FIELD_BASE, 'text-georgian resize-none leading-relaxed', className)}
        {...props}
      />
      {hint ? <p className="mt-1.5 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  )
}

export function SelectField({
  label,
  options,
  className,
  ...props
}: {
  label: string
  options: { value: string; label: string }[]
} & ComponentProps<'select'>) {
  const id = useId()
  return (
    <div className="mb-4">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={cn(FIELD_BASE, 'appearance-none pr-10', className)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

/** Dreiwertig: ja / nein / weiß ich nicht. „Unbekannt" ist eine gültige Antwort. */
export function TriToggle({
  label,
  value,
  onChange,
  labels,
}: {
  label: string
  value: boolean | null
  onChange: (value: boolean | null) => void
  labels: { yes: string; no: string; unknown: string }
}) {
  const options: { key: 'yes' | 'no' | 'unknown'; value: boolean | null; label: string }[] = [
    { key: 'yes', value: true, label: labels.yes },
    { key: 'no', value: false, label: labels.no },
    { key: 'unknown', value: null, label: labels.unknown },
  ]

  return (
    <div className="mb-4">
      <p className="mb-1.5 text-sm text-ink-muted">{label}</p>
      <div className="flex gap-2">
        {options.map((option) => {
          const active = value === option.value
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                'flex-1 rounded-control border px-3 py-2.5 text-sm transition-all duration-200',
                active
                  ? 'border-alubali bg-alubali-soft font-medium text-alubali'
                  : 'border-line bg-paper-raised text-ink-muted hover:border-line-strong',
              )}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Mehrfachauswahl aus einem Katalog — Chips statt Checkbox-Liste. */
export function ChipSelect<T extends string>({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string
  options: { value: T; label: string }[]
  selected: readonly T[]
  onToggle: (value: T) => void
}) {
  return (
    <div className="mb-4">
      <p className="mb-2 text-sm text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option.value)
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onToggle(option.value)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-all duration-200',
                active
                  ? 'border-alubali bg-alubali-soft font-medium text-alubali'
                  : 'border-line bg-paper-raised text-ink-muted hover:border-line-strong',
              )}
            >
              {active ? <Check className="size-3.5" /> : null}
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Segmentierte Umschaltung — ersetzt Tabs auf schmalen Displays. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div className="flex gap-1 rounded-full bg-paper-sunken p-1">
      {options.map((option) => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              'flex-1 rounded-full px-3 py-2 text-sm transition-all duration-250',
              active
                ? 'bg-paper-raised font-medium text-ink shadow-soft'
                : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
