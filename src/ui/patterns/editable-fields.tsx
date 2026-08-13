'use client'

import { Check, Pencil } from 'lucide-react'

import { formatDate, germanLevelKey, type MessageKey } from '@/core/i18n'
import { useT } from '@/core/i18n/client'
import type { DraftField, FieldType } from '@/modules/assistant/describe'
import { cn } from '@/ui/cn'
import { Chip } from '@/ui/primitives'

/**
 * Feldanzeige und Feldbearbeitung.
 *
 * Ein Muster für beide Orte, an denen Daten angefasst werden: die
 * Bestätigungskarte nach dem Sprechen und die Detailansicht. Dieselbe Geste,
 * dasselbe Aussehen — sie muss nur einmal lernen, dass man Werte antippt.
 */

export type { DraftField, FieldType }

export function DisplayValue({ field, value }: { field: DraftField; value: unknown }) {
  const t = useT()

  if (value === null || value === undefined || value === '') {
    return <span className="font-normal text-ink-faint">{t('value.unknown')}</span>
  }

  switch (field.type) {
    case 'bool':
      return <>{value ? t('value.yes') : t('value.no')}</>
    case 'date':
      return <>{formatDate(String(value))}</>
    case 'german':
      return <>{t(germanLevelKey(Number(value)))}</>
    case 'number':
      // Geburtsjahr wird als Alter angezeigt — so, wie sie es gesagt hat.
      if (field.key.includes('birth_year')) {
        return <>{new Date().getFullYear() - Number(value)}</>
      }
      return <>{String(value)}</>
    case 'skills':
    case 'tasks': {
      const items = Array.isArray(value) ? value : []
      const prefix = field.type === 'skills' ? 'skill.' : 'caretask.'
      return (
        <span className="flex flex-wrap justify-end gap-1.5">
          {items.map((item) => (
            <Chip key={String(item)} tone="accent">
              {t(`${prefix}${String(item)}` as MessageKey)}
            </Chip>
          ))}
        </span>
      )
    }
    case 'enum':
      return <>{t(`${field.enumPrefix ?? ''}${String(value)}` as MessageKey)}</>
    case 'longtext':
      return <span className="text-georgian block text-right font-normal">{String(value)}</span>
    default:
      return <>{String(value)}</>
  }
}

export function FieldEditor({
  field,
  value,
  onChange,
  skillOptions = [],
  taskOptions = [],
}: {
  field: DraftField
  value: unknown
  onChange: (value: unknown) => void
  skillOptions?: readonly string[]
  taskOptions?: readonly string[]
}) {
  const t = useT()
  const inputClass =
    'w-full rounded-control border border-line bg-paper-raised px-4 py-2.5 text-[1rem] focus:border-gold focus:outline-none'

  if (field.type === 'bool') {
    return (
      <div className="flex gap-2">
        {[
          { label: t('value.yes'), next: true as boolean | null },
          { label: t('value.no'), next: false as boolean | null },
          { label: t('value.unknown'), next: null },
        ].map((option) => (
          <button
            key={String(option.next)}
            type="button"
            onClick={() => onChange(option.next)}
            className={cn(
              'flex-1 rounded-control border px-3 py-2.5 text-sm transition-all',
              value === option.next
                ? 'border-alubali bg-alubali-soft font-medium text-alubali'
                : 'border-line text-ink-muted',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    )
  }

  if (field.type === 'german') {
    return (
      <div className="flex flex-wrap gap-2">
        {[0, 1, 2, 3, 4, 5, 6].map((level) => (
          <button
            key={level}
            type="button"
            onClick={() => onChange(level)}
            className={cn(
              'rounded-full border px-4 py-2 text-sm transition-all',
              Number(value) === level
                ? 'border-alubali bg-alubali-soft font-medium text-alubali'
                : 'border-line text-ink-muted',
            )}
          >
            {t(germanLevelKey(level))}
          </button>
        ))}
      </div>
    )
  }

  if (field.type === 'enum') {
    return (
      <div className="flex flex-wrap gap-2">
        {(field.enumOptions ?? []).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-full border px-3.5 py-2 text-sm transition-all',
              value === option
                ? 'border-alubali bg-alubali-soft font-medium text-alubali'
                : 'border-line text-ink-muted',
            )}
          >
            {t(`${field.enumPrefix ?? ''}${option}` as MessageKey)}
          </button>
        ))}
      </div>
    )
  }

  if (field.type === 'skills' || field.type === 'tasks') {
    const options = field.type === 'skills' ? skillOptions : taskOptions
    const prefix = field.type === 'skills' ? 'skill.' : 'caretask.'
    const selected = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = selected.includes(option)
          return (
            <button
              key={option}
              type="button"
              onClick={() =>
                onChange(active ? selected.filter((item) => item !== option) : [...selected, option])
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-sm transition-all',
                active
                  ? 'border-alubali bg-alubali-soft font-medium text-alubali'
                  : 'border-line text-ink-muted',
              )}
            >
              {active ? <Check className="size-3.5" /> : null}
              {t(`${prefix}${option}` as MessageKey)}
            </button>
          )
        })}
      </div>
    )
  }

  if (field.type === 'date') {
    return (
      <input
        type="date"
        className={inputClass}
        defaultValue={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value || null)}
      />
    )
  }

  if (field.type === 'number') {
    const isAge = field.key.includes('birth_year')
    const shown =
      value === null || value === undefined
        ? ''
        : isAge
          ? String(new Date().getFullYear() - Number(value))
          : String(value)
    return (
      <input
        type="number"
        inputMode="numeric"
        className={inputClass}
        defaultValue={shown}
        onChange={(event) => {
          const raw = event.target.value
          if (raw === '') return onChange(null)
          const parsed = Number(raw)
          onChange(isAge ? new Date().getFullYear() - parsed : parsed)
        }}
      />
    )
  }

  if (field.type === 'longtext') {
    return (
      <textarea
        rows={4}
        className={cn(inputClass, 'text-georgian resize-none')}
        defaultValue={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value || null)}
      />
    )
  }

  return (
    <input
      type="text"
      className={inputClass}
      defaultValue={typeof value === 'string' ? value : ''}
      onChange={(event) => onChange(event.target.value || null)}
    />
  )
}

export function FieldRow({
  field,
  value,
  editing,
  onEdit,
  onChange,
  skillOptions,
  taskOptions,
}: {
  field: DraftField
  value: unknown
  editing: boolean
  onEdit: () => void
  onChange: (value: unknown) => void
  skillOptions?: readonly string[]
  taskOptions?: readonly string[]
}) {
  const t = useT()

  if (editing) {
    return (
      <div className="py-3.5 animate-in">
        <p className="mb-2 text-sm text-ink-muted">{t(field.labelKey)}</p>
        <FieldEditor
          field={field}
          value={value}
          onChange={onChange}
          skillOptions={skillOptions}
          taskOptions={taskOptions}
        />
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onEdit}
      className="group flex w-full items-start justify-between gap-4 py-3.5 text-left"
    >
      <span className="shrink-0 pt-0.5 text-sm text-ink-muted">{t(field.labelKey)}</span>
      <span className="flex min-w-0 items-center gap-2">
        <span
          className={cn(
            'text-right text-[0.95rem] font-medium text-ink',
            field.uncertain && 'text-gold-deep',
          )}
        >
          <DisplayValue field={field} value={value} />
        </span>
        <Pencil className="size-3.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  )
}
