'use client'

import { HelpCircle } from 'lucide-react'
import { useState, useTransition } from 'react'

import type { MessageKey } from '@/core/i18n'
import { useT } from '@/core/i18n/client'
import type { DraftField } from '@/modules/assistant/describe'
import { Card } from '@/ui/primitives'
import { FieldRow } from './editable-fields'

/**
 * Bearbeitbare Detailansicht.
 *
 * Speichern passiert sofort beim Ändern eines Feldes — es gibt keinen
 * „Bearbeiten"-Modus und keinen Speichern-Knopf. Wer nicht technikaffin ist,
 * verliert Daten genau an solchen Modi.
 *
 * Fehlende Angaben stehen unten als Frage mit einem Knopf, der daraus eine
 * Aufgabe macht. Datenqualität wächst durch Benutzung, nicht durch Pflichtfelder.
 */
export function EntityDetail({
  fields,
  entityId,
  onSave,
  skillOptions,
  taskOptions,
  missingTitle,
  onAsk,
}: {
  fields: DraftField[]
  entityId: string
  onSave: (entityId: string, patchJson: string) => Promise<void>
  skillOptions?: readonly string[]
  taskOptions?: readonly string[]
  missingTitle?: MessageKey
  onAsk?: (entityId: string, label: string) => Promise<void>
}) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, field.value])),
  )
  const [editing, setEditing] = useState<string | null>(null)
  const [asked, setAsked] = useState<string[]>([])

  const update = (key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }))
    setEditing(null)
    startTransition(async () => {
      await onSave(entityId, JSON.stringify({ [key]: value }))
    })
  }

  const isEmpty = (value: unknown) =>
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)

  const filled = fields.filter((field) => !isEmpty(values[field.key]))
  const missing = fields.filter((field) => field.ask && isEmpty(values[field.key]))

  return (
    <div className="space-y-5">
      <Card className="px-5">
        <div className="divide-y divide-line">
          {filled.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={values[field.key]}
              editing={editing === field.key}
              onEdit={() => setEditing(editing === field.key ? null : field.key)}
              onChange={(value) => update(field.key, value)}
              skillOptions={skillOptions}
              taskOptions={taskOptions}
            />
          ))}
        </div>
      </Card>

      {missing.length > 0 ? (
        <Card className="bg-paper-sunken/50 px-5 py-4">
          <p className="mb-3 text-sm text-ink-muted">
            {t(missingTitle ?? 'caregiver.missing')}
          </p>
          <div className="divide-y divide-line">
            {missing.map((field) => (
              <div key={field.key} className="flex items-center justify-between gap-3 py-2.5">
                {editing === field.key ? (
                  <div className="w-full">
                    <p className="mb-2 text-sm text-ink-muted">{t(field.labelKey)}</p>
                    <FieldRow
                      field={field}
                      value={values[field.key]}
                      editing
                      onEdit={() => undefined}
                      onChange={(value) => update(field.key, value)}
                      skillOptions={skillOptions}
                      taskOptions={taskOptions}
                    />
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setEditing(field.key)}
                      className="flex-1 text-left text-[0.95rem] text-ink-soft"
                    >
                      {t(field.labelKey)}
                    </button>
                    {onAsk ? (
                      <button
                        type="button"
                        disabled={pending || asked.includes(field.key)}
                        onClick={() => {
                          setAsked((current) => [...current, field.key])
                          startTransition(async () => {
                            await onAsk(entityId, t(field.labelKey))
                          })
                        }}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-paper-raised px-3 py-1.5 text-xs text-ink-muted transition-colors hover:text-alubali disabled:opacity-50"
                      >
                        <HelpCircle className="size-3.5" />
                        {asked.includes(field.key) ? t('action.done') : t('caregiver.askAbout')}
                      </button>
                    ) : null}
                  </>
                )}
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}
