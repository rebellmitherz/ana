'use client'

import { ArrowRight, Mic, Square } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useCallback, useRef, useState, useTransition } from 'react'

import { useT } from '@/core/i18n/client'
import { cn } from '@/ui/cn'
import { Button } from '@/ui/primitives'
import {
  extensionForBlob,
  isRecordingSupported,
  startRecording,
  type RecorderHandle,
} from '@/ui/voice/recorder'
import { completeOnboardingAction, saveNameAction } from './actions'

/**
 * Erstöffnung. Ziel: unter 60 Sekunden bis zum ersten echten Nutzen.
 *
 * Der Demo-Moment ist bewusst persönlich und nicht geschäftlich. Ein
 * „Lege deine erste Pflegerin an" würde sagen: hier ist ein CRM. Ein
 * „Erzähl mir, wie dein Tag war" sagt: das ist deine App. Das Geschäft
 * entdeckt sie zehn Minuten später von selbst.
 */
type Step = 'welcome' | 'name' | 'demo' | 'result'

export function OnboardingFlow() {
  const t = useT()
  const router = useRouter()
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [recording, setRecording] = useState(false)
  const [working, setWorking] = useState(false)
  const [transcript, setTranscript] = useState<string | null>(null)
  const [translation, setTranslation] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const handleRef = useRef<RecorderHandle | null>(null)

  const finish = useCallback(() => {
    startTransition(async () => {
      await completeOnboardingAction()
      router.replace('/')
    })
  }, [router])

  const stopAndProcess = useCallback(async () => {
    const handle = handleRef.current
    if (!handle) return
    handleRef.current = null
    setRecording(false)
    setWorking(true)

    try {
      const blob = await handle.stop()
      const form = new FormData()
      form.append('audio', blob, `moment.${extensionForBlob(blob)}`)

      const response = await fetch('/api/transcribe', { method: 'POST', body: form })
      if (!response.ok) throw new Error('failed')
      const result = (await response.json()) as { text?: string }
      const text = result.text ?? ''
      setTranscript(text)

      // Sofort zeigen, was die App damit kann: dasselbe auf Deutsch.
      const translateForm = new FormData()
      translateForm.append('text', text)
      const translated = await fetch('/api/onboarding-translate', {
        method: 'POST',
        body: translateForm,
      })
      if (translated.ok) {
        const data = (await translated.json()) as { translation?: string }
        setTranslation(data.translation ?? null)
      }
      setStep('result')
    } catch {
      setStep('result')
    } finally {
      setWorking(false)
    }
  }, [])

  const start = useCallback(async () => {
    if (!isRecordingSupported()) {
      setStep('result')
      return
    }
    try {
      handleRef.current = await startRecording({ onSilence: () => void stopAndProcess() })
      setRecording(true)
    } catch {
      setStep('result')
    }
  }, [stopAndProcess])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-7 pb-safe pt-safe">
      {step === 'welcome' ? (
        <div className="animate-rise text-center">
          <p className="font-display text-[2.6rem] leading-tight text-alubali">
            {t('onboarding.welcome.title')}
          </p>
          <div className="rule-gold mx-auto my-7 w-24 opacity-60" />
          <p className="text-georgian text-[1.05rem] text-ink-soft">
            {t('onboarding.welcome.body')}
          </p>
          <Button className="mt-12" full size="lg" onClick={() => setStep('name')}>
            {t('onboarding.start')}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}

      {step === 'name' ? (
        <div className="animate-rise">
          <h1 className="font-display text-[1.9rem] leading-tight text-ink">
            {t('onboarding.name.question')}
          </h1>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('onboarding.name.placeholder')}
            className="mt-8 w-full rounded-control border border-line bg-paper-raised px-4 py-4 text-[1.1rem] placeholder:text-ink-faint focus:border-gold focus:outline-none"
          />
          <Button
            className="mt-6"
            full
            size="lg"
            disabled={name.trim().length === 0}
            onClick={() => {
              startTransition(async () => {
                await saveNameAction(name)
              })
              setStep('demo')
            }}
          >
            {t('action.continue')}
          </Button>
          <button
            type="button"
            onClick={() => setStep('demo')}
            className="mt-3 w-full py-2 text-sm text-ink-faint"
          >
            {t('action.skip')}
          </button>
        </div>
      ) : null}

      {step === 'demo' ? (
        <div className="animate-rise text-center">
          <h1 className="font-display text-[1.7rem] leading-tight text-ink">
            {t('onboarding.demo.title')}
          </h1>
          <p className="text-georgian mt-3 text-[1.02rem] text-ink-muted">
            {t('onboarding.demo.prompt')}
          </p>

          <div className="my-14 flex justify-center">
            <button
              type="button"
              disabled={working}
              onClick={() => (recording ? void stopAndProcess() : void start())}
              className={cn(
                'relative flex size-[104px] items-center justify-center rounded-full text-paper-raised shadow-float transition-all duration-300 active:scale-95',
                recording ? 'bg-ink' : 'bg-alubali',
              )}
            >
              {!recording && !working ? (
                <span className="absolute inset-0 animate-pulse-slow rounded-full bg-alubali/40" />
              ) : null}
              {recording ? (
                <Square className="relative size-8 fill-current" />
              ) : (
                <Mic className="relative size-10" strokeWidth={1.5} />
              )}
            </button>
          </div>

          <p className="text-sm text-ink-faint">
            {working ? t('voice.processing') : recording ? t('voice.listening') : t('voice.tapToStart')}
          </p>

          <button
            type="button"
            onClick={finish}
            className="mt-14 w-full py-2 text-sm text-ink-faint"
          >
            {t('action.skip')}
          </button>
        </div>
      ) : null}

      {step === 'result' ? (
        <div className="animate-rise">
          {transcript ? (
            <div className="rounded-card border border-line bg-paper-raised p-5 shadow-soft">
              <p className="text-georgian text-[1.02rem] leading-relaxed text-ink">{transcript}</p>
              {translation ? (
                <>
                  <div className="rule-gold my-4 opacity-50" />
                  <p className="text-[0.98rem] leading-relaxed text-ink-soft">{translation}</p>
                </>
              ) : null}
            </div>
          ) : null}

          <p className="text-georgian mt-8 text-center font-display text-[1.3rem] leading-snug text-ink">
            {t('onboarding.demo.result')}
          </p>

          <Button className="mt-10" full size="lg" onClick={finish}>
            {t('action.continue')}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}
