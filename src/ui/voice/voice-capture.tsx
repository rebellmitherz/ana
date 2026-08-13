'use client'

import { Mic, Square, Upload, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { useT } from '@/core/i18n/client'
import { cn } from '@/ui/cn'
import { Button } from '@/ui/primitives'
import { StepProgress } from '@/ui/feedback'
import {
  extensionForBlob,
  isRecordingSupported,
  startRecording,
  type RecorderHandle,
} from './recorder'

type Phase = 'idle' | 'recording' | 'uploading' | 'error'
export type CaptureContext = 'home' | 'caregiver' | 'family' | 'note'

/**
 * Der zentrale Sprachknopf.
 *
 * Tap-to-start statt Halten: Eine Pflegerin zu beschreiben dauert 30 bis 50
 * Sekunden — einen Daumen so lange gedrückt zu halten ist eine Zumutung und
 * produziert Abbrüche.
 *
 * Nach der Aufnahme wird nie direkt gespeichert. Es entsteht ein Entwurf, den
 * sie auf der Bestätigungskarte prüft und antippt.
 */
export function VoiceCapture({
  context = 'home',
  variant = 'hero',
  label,
}: {
  context?: CaptureContext
  variant?: 'hero' | 'fab'
  label?: string
}) {
  const t = useT()
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [seconds, setSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [errorKey, setErrorKey] = useState<'permission' | 'unsupported' | 'failed'>('failed')
  const [step, setStep] = useState(0)

  const handleRef = useRef<RecorderHandle | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const supported = useRef(true)

  useEffect(() => {
    supported.current = isRecordingSupported()
  }, [])

  const upload = useCallback(
    async (blob: Blob, fileName: string) => {
      setPhase('uploading')
      setStep(0)

      const stepTimer = window.setInterval(() => {
        setStep((current) => Math.min(current + 1, 2))
      }, 1400)

      try {
        const form = new FormData()
        form.append('audio', blob, fileName)
        form.append('context', context)

        const response = await fetch('/api/voice', { method: 'POST', body: form })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)

        const result = (await response.json()) as { draftId?: string }
        if (!result.draftId) throw new Error('Kein Entwurf')

        router.push(`/confirm/${result.draftId}`)
      } catch {
        setErrorKey('failed')
        setPhase('error')
      } finally {
        window.clearInterval(stepTimer)
      }
    },
    [context, router],
  )

  const finish = useCallback(async () => {
    const handle = handleRef.current
    if (!handle) return
    handleRef.current = null
    const blob = await handle.stop()
    if (blob.size < 1200) {
      // Nichts Verwertbares aufgenommen — zurück in den Ruhezustand, keine Fehlermeldung.
      setPhase('idle')
      return
    }
    await upload(blob, `aufnahme.${extensionForBlob(blob)}`)
  }, [upload])

  const begin = useCallback(async () => {
    if (!isRecordingSupported()) {
      fileInputRef.current?.click()
      return
    }

    try {
      setSeconds(0)
      setLevel(0)
      const handle = await startRecording({ onSilence: () => void finish() })
      handleRef.current = handle
      setPhase('recording')
    } catch (error) {
      const code = (error as { code?: 'permission' | 'unsupported' | 'failed' }).code ?? 'failed'
      setErrorKey(code)
      setPhase('error')
    }
  }, [finish])

  const cancel = useCallback(() => {
    handleRef.current?.cancel()
    handleRef.current = null
    setPhase('idle')
  }, [])

  // Timer und Pegel nur während der Aufnahme.
  useEffect(() => {
    if (phase !== 'recording') return
    const tick = window.setInterval(() => setSeconds((value) => value + 1), 1000)
    const meter = window.setInterval(() => setLevel(handleRef.current?.level() ?? 0), 90)
    return () => {
      window.clearInterval(tick)
      window.clearInterval(meter)
    }
  }, [phase])

  useEffect(() => () => handleRef.current?.cancel(), [])

  const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) void upload(file, file.name)
    event.target.value = ''
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        capture
        className="hidden"
        onChange={onFilePicked}
      />

      {variant === 'hero' ? (
        <HeroButton label={label ?? t('home.voice.cta')} hint={t('home.voice.hint')} onPress={begin} />
      ) : (
        <FabButton label={t('voice.tapToStart')} onPress={begin} />
      )}

      {phase !== 'idle' ? (
        <Overlay onClose={phase === 'recording' ? cancel : () => setPhase('idle')}>
          {phase === 'recording' ? (
            <RecordingView
              seconds={seconds}
              level={level}
              listening={t('voice.listening')}
              stopLabel={t('voice.stop')}
              onStop={() => void finish()}
            />
          ) : null}

          {phase === 'uploading' ? (
            <div className="w-full max-w-xs">
              <StepProgress
                steps={[t('doc.analyzing.step1'), t('doc.analyzing.step2'), t('doc.analyzing.step3')]}
                active={step}
              />
            </div>
          ) : null}

          {phase === 'error' ? (
            <div className="w-full max-w-xs text-center">
              <p className="font-display text-lg text-ink">
                {errorKey === 'permission'
                  ? t('voice.permissionDenied')
                  : errorKey === 'unsupported'
                    ? t('voice.unsupported')
                    : t('voice.notUnderstood')}
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                {errorKey === 'permission'
                  ? t('voice.permissionDenied.help')
                  : t('voice.notUnderstood.help')}
              </p>
              <div className="mt-7 flex flex-col gap-2">
                <Button onClick={() => void begin()} full>
                  {t('action.retry')}
                </Button>
                <Button tone="ghost" full onClick={() => fileInputRef.current?.click()}>
                  <Upload className="size-4" />
                  {t('action.upload')}
                </Button>
              </div>
            </div>
          ) : null}
        </Overlay>
      ) : null}
    </>
  )
}

/* -------------------------------------------------------------------------- */

function HeroButton({
  label,
  hint,
  onPress,
}: {
  label: string
  hint: string
  onPress: () => void
}) {
  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onPress}
        aria-label={label}
        className="group relative flex size-[92px] items-center justify-center rounded-full bg-alubali text-paper-raised shadow-float transition-transform duration-300 active:scale-95"
      >
        <span className="absolute inset-0 animate-pulse-slow rounded-full bg-alubali/40" aria-hidden />
        <Mic className="relative size-9" strokeWidth={1.6} />
      </button>
      <p className="mt-5 max-w-[24ch] text-center text-[1.05rem] leading-snug text-ink">{label}</p>
      <p className="mt-1 text-sm text-ink-faint">{hint}</p>
    </div>
  )
}

function FabButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-label={label}
      className="fixed bottom-6 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-alubali text-paper-raised shadow-float transition-transform duration-300 active:scale-95 mb-safe"
    >
      <Mic className="size-6" strokeWidth={1.7} />
    </button>
  )
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-paper/95 px-6 backdrop-blur-sm animate-in">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-5 top-5 flex size-11 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-paper-sunken pt-safe"
        aria-label="close"
      >
        <X className="size-5" />
      </button>
      {children}
    </div>
  )
}

function RecordingView({
  seconds,
  level,
  listening,
  stopLabel,
  onStop,
}: {
  seconds: number
  level: number
  listening: string
  stopLabel: string
  onStop: () => void
}) {
  const bars = 24
  return (
    <div className="flex w-full max-w-xs flex-col items-center">
      <p className="mb-8 text-[1.05rem] text-ink-soft">{listening}</p>

      <div className="mb-8 flex h-16 items-center justify-center gap-[3px]" aria-hidden>
        {Array.from({ length: bars }).map((_, index) => {
          // Mitte lauter als die Ränder — wirkt organischer als ein flacher Balken.
          const distance = Math.abs(index - (bars - 1) / 2) / ((bars - 1) / 2)
          // Deterministische Streuung statt Math.random: gleiches Rendering bei
          // gleichem Pegel, und die Wellenform bleibt trotzdem unruhig genug.
          const jitter = 0.55 + (Math.sin(index * 12.9898 + seconds * 3.7) * 0.5 + 0.5) * 0.75
          const height = 4 + level * 56 * (1 - distance * 0.65) * jitter
          return (
            <span
              key={index}
              className="w-[3px] rounded-full bg-alubali transition-all duration-100"
              style={{ height: `${Math.max(4, Math.min(60, height))}px`, opacity: 0.35 + level * 0.65 }}
            />
          )
        })}
      </div>

      <p className="mb-9 font-display text-2xl tabular-nums text-ink">
        {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
      </p>

      <button
        type="button"
        onClick={onStop}
        className={cn(
          'flex h-14 w-full items-center justify-center gap-2.5 rounded-control',
          'bg-ink text-paper-raised transition-transform duration-200 active:scale-[0.98]',
        )}
      >
        <Square className="size-4 fill-current" />
        {stopLabel}
      </button>
    </div>
  )
}
