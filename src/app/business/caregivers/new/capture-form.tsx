'use client'

import { useState, useTransition } from 'react'

import { useT } from '@/core/i18n/client'
import { Button } from '@/ui/primitives'
import { VoiceTextInput } from '@/ui/voice/voice-text-input'

/**
 * Neue Pflegerin — erzählen statt ausfüllen.
 *
 * Sie beschreibt die Person in eigenen Worten (gesprochen oder getippt), das
 * System strukturiert daraus einen Entwurf. Das klassische Formular gibt es
 * trotzdem: über die Detailansicht lässt sich jedes Feld einzeln setzen.
 */
export function CaptureForm({
  action,
  placeholder,
  submitLabel,
}: {
  action: (formData: FormData) => Promise<void>
  placeholder: string
  submitLabel: string
}) {
  const t = useT()
  const [text, setText] = useState('')
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-4">
      <VoiceTextInput
        name="text-visible"
        value={text}
        onChange={setText}
        placeholder={placeholder}
        rows={7}
        autoFocus
      />

      <Button
        full
        size="lg"
        disabled={pending || text.trim().length < 5}
        onClick={() => {
          const data = new FormData()
          data.append('text', text)
          startTransition(async () => {
            await action(data)
          })
        }}
      >
        {pending ? t('voice.processing') : submitLabel}
      </Button>
    </div>
  )
}
