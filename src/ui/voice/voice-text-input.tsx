'use client'

import { Loader2, Mic, Square } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

import { useT } from '@/core/i18n/client'
import { cn } from '@/ui/cn'
import {
  extensionForBlob,
  isRecordingSupported,
  startRecording,
  type RecorderHandle,
} from './recorder'

/**
 * Textfeld mit Diktierknopf.
 *
 * Sprechen ist hier eine Bequemlichkeit, kein Zwang — auf dem Feld lässt sich
 * jederzeit tippen. Im Bus, in der Bahn, neben einem schlafenden Patienten ist
 * Tippen die einzige Möglichkeit; die App darf das nie erschweren.
 */
export function VoiceTextInput({
  name,
  value,
  onChange,
  placeholder,
  rows = 4,
  autoFocus,
}: {
  name: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  autoFocus?: boolean
}) {
  const t = useT()
  const [state, setState] = useState<'idle' | 'recording' | 'working'>('idle')
  const handleRef = useRef<RecorderHandle | null>(null)

  // Gerätefähigkeit ist externer Zustand, kein React-Zustand — deshalb hier
  // useSyncExternalStore statt setState im Effekt. Server rendert immer `false`,
  // damit Hydration nicht auseinanderläuft.
  const supported = useSyncExternalStore(
    () => () => undefined,
    () => isRecordingSupported(),
    () => false,
  )

  useEffect(() => () => handleRef.current?.cancel(), [])

  const stop = useCallback(async () => {
    const handle = handleRef.current
    if (!handle) return
    handleRef.current = null
    setState('working')

    try {
      const blob = await handle.stop()
      if (blob.size < 1200) {
        setState('idle')
        return
      }
      const form = new FormData()
      form.append('audio', blob, `diktat.${extensionForBlob(blob)}`)
      const response = await fetch('/api/transcribe', { method: 'POST', body: form })
      if (response.ok) {
        const result = (await response.json()) as { text?: string }
        if (result.text) onChange(value ? `${value} ${result.text}` : result.text)
      }
    } finally {
      setState('idle')
    }
  }, [onChange, value])

  const start = useCallback(async () => {
    try {
      handleRef.current = await startRecording({ onSilence: () => void stop(), silenceMs: 2200 })
      setState('recording')
    } catch {
      setState('idle')
    }
  }, [stop])

  return (
    <div className="relative">
      <textarea
        name={name}
        rows={rows}
        autoFocus={autoFocus}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={cn(
          'text-georgian w-full resize-none rounded-card border border-line bg-paper-raised',
          'px-4 py-3.5 pb-14 text-[1rem] leading-relaxed text-ink placeholder:text-ink-faint',
          'transition-colors focus:border-gold focus:outline-none',
        )}
      />

      {supported ? (
        <button
          type="button"
          onClick={() => (state === 'recording' ? void stop() : void start())}
          disabled={state === 'working'}
          aria-label={t('voice.tapToStart')}
          className={cn(
            'absolute bottom-3 left-3 flex h-9 items-center gap-2 rounded-full px-3.5 text-sm transition-all duration-200',
            state === 'recording'
              ? 'bg-alubali text-paper-raised'
              : 'bg-paper-sunken text-ink-muted hover:text-ink',
          )}
        >
          {state === 'working' ? (
            <Loader2 className="size-4 animate-spin" />
          ) : state === 'recording' ? (
            <Square className="size-3.5 fill-current" />
          ) : (
            <Mic className="size-4" />
          )}
          {state === 'recording' ? t('voice.stop') : state === 'working' ? '' : t('home.voice.hint')}
        </button>
      ) : null}
    </div>
  )
}
