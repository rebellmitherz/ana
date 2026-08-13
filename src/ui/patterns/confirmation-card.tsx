'use client'

import { AlertCircle, ChevronDown } from 'lucide-react'
import { useState, useTransition } from 'react'

import type { MessageKey } from '@/core/i18n'
import { useT } from '@/core/i18n/client'
import type { DraftField } from '@/modules/assistant/describe'
import { cn } from '@/ui/cn'
import { Button, Card } from '@/ui/primitives'
import { FieldEditor, FieldRow } from './editable-fields'

/**
 * Die Bestätigungskarte.
 *
 * Sie ist die zentrale Sicherheitsmaßnahme der Anwendung: Kein Modellvorschlag
 * wird gespeichert, ohne dass sie ihn gesehen hat. Und sie ist zugleich die
 * Kompensation für ungenaue Spracherkennung — ein falsch verstandenes „A2"
 * korrigiert sie mit zwei Tipps, statt vierzig Sekunden neu zu sprechen.
 *
 * Unsichere Werte stehen in Gold. Fehlende wichtige Angaben werden zu einer
 * Frage mit Antwortknöpfen, nicht zu einem leeren Pflichtfeld.
 */

export interface ConfirmationCardProps {
  draftId: string
  titleKey: MessageKey
  fields: DraftField[]
  payload: Record<string, unknown>
  transcript: string | null
  skillOptions: readonly string[]
  taskOptions: readonly string[]
  onConfirm: (draftId: string, payloadJson: string) => Promise<void>
  onDiscard: (draftId: string) => Promise<void>
}

function setPath(target: Record<string, unknown>, path: string, value: unknown): void {
  const segments = path.split('.')
  let cursor = target
  for (let index = 0; index < segments.length - 1; index += 1) {
    const key = segments[index]!
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {}
    cursor = cursor[key] as Record<string, unknown>
  }
  cursor[segments[segments.length - 1]!] = value
}

function isEmpty(value: unknown): boolean {
  return (
    value === null ||
    value === undefined ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  )
}

export function ConfirmationCard(props: ConfirmationCardProps) {
  const t = useT()
  const [pending, startTransition] = useTransition()
  const [values, setValues] = useState<Record<string, unknown>>(() =>
    Object.fromEntries(props.fields.map((field) => [field.key, field.value])),
  )
  const [editing, setEditing] = useState<string | null>(null)
  const [showTranscript, setShowTranscript] = useState(false)

  const shown = props.fields.filter((field) => !isEmpty(values[field.key]))
  const questions = props.fields.filter((field) => field.ask && isEmpty(values[field.key]))

  const update = (key: string, value: unknown) => {
    setValues((current) => ({ ...current, [key]: value }))
    setEditing(null)
  }

  const submit = () => {
    const payload = structuredClone(props.payload)
    for (const [key, value] of Object.entries(values)) {
      setPath(payload, key, value)
    }
    startTransition(async () => {
      await props.onConfirm(props.draftId, JSON.stringify(payload))
    })
  }

  return (
    <div className="animate-rise">
      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="font-display text-[1.3rem] text-ink">{t(props.titleKey)}</h2>
        </div>

        <div className="divide-y divide-line px-5">
          {shown.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              value={values[field.key]}
              editing={editing === field.key}
              onEdit={() => setEditing(editing === field.key ? null : field.key)}
              onChange={(value) => update(field.key, value)}
              skillOptions={props.skillOptions}
              taskOptions={props.taskOptions}
            />
          ))}
        </div>

        {questions.length > 0 ? (
          <div className="border-t border-line bg-paper-sunken/50 px-5 py-4">
            <p className="mb-3.5 flex items-center gap-2 text-sm text-ink-muted">
              <AlertCircle className="size-4 text-gold-deep" />
              {t('confirm.missing')}
            </p>
            {/* Höchstens zwei Rückfragen. Mehr wäre ein Formular. */}
            <div className="space-y-4">
              {questions.slice(0, 2).map((field) => (
                <div key={field.key}>
                  <p className="mb-2 text-[0.95rem] text-ink">{t(field.labelKey)}?</p>
                  <FieldEditor
                    field={field}
                    value={values[field.key]}
                    onChange={(value) => update(field.key, value)}
                    skillOptions={props.skillOptions}
                    taskOptions={props.taskOptions}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </Card>

      {props.transcript ? (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowTranscript((value) => !value)}
            className="flex w-full items-center justify-between rounded-control px-1 py-2 text-sm text-ink-faint transition-colors hover:text-ink-muted"
          >
            {t('voice.transcript')}
            <ChevronDown
              className={cn(
                'size-4 transition-transform duration-300',
                showTranscript && 'rotate-180',
              )}
            />
          </button>
          {showTranscript ? (
            <p className="text-georgian rounded-card bg-paper-sunken px-4 py-3 text-sm text-ink-soft animate-in">
              {props.transcript}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="mt-7 space-y-2">
        <Button full size="lg" onClick={submit} disabled={pending}>
          {pending ? t('state.saving') : t('action.save')}
        </Button>
        <form action={props.onDiscard.bind(null, props.draftId)}>
          <Button tone="quiet" full type="submit" disabled={pending}>
            {t('confirm.discard')}
          </Button>
        </form>
      </div>
    </div>
  )
}
