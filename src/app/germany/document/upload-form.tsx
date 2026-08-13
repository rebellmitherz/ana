'use client'

import { Camera, FolderOpen } from 'lucide-react'
import { useActionState, useEffect, useRef, useState } from 'react'

import { useT } from '@/core/i18n/client'
import { explainDocumentAction, type UploadState } from '@/modules/documents/actions'
import { Button } from '@/ui/primitives'
import { ErrorState, StepProgress } from '@/ui/feedback'

/**
 * Foto oder Datei hochladen.
 *
 * Das Bild wird vor dem Upload clientseitig verkleinert: spart Bandbreite im
 * Mobilfunknetz, spart Speicher — und spart Vision-Tokens, was direkt auf die
 * Betriebskosten durchschlägt.
 *
 * Abgeschickt wird über ein echtes `<form action={…}>`, nicht über einen
 * imperativen Aufruf der Action. Nur so verwaltet React den Übergang selbst und
 * `isPending` stimmt — und genau davon hängt der Fortschrittsanzeiger ab.
 */
const MAX_EDGE = 2000
const JPEG_QUALITY = 0.82

async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic') return file

  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1_500_000) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const context = canvas.getContext('2d')
    if (!context) return file
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
    )
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function UploadForm() {
  const t = useT()
  const [state, action, pending] = useActionState<UploadState, FormData>(explainDocumentAction, {
    error: null,
  })
  const [step, setStep] = useState(0)

  const formRef = useRef<HTMLFormElement>(null)
  const payloadRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Der Fortschritt läuft nur während der Analyse; zurückgesetzt wird er beim
  // Auswählen, nicht im Effekt — synchrones setState im Effekt erzeugt Kaskaden.
  useEffect(() => {
    if (!pending) return
    const timer = window.setInterval(() => setStep((value) => Math.min(value + 1, 2)), 2200)
    return () => window.clearInterval(timer)
  }, [pending])

  const pick = async (input: HTMLInputElement) => {
    const file = input.files?.[0]
    if (!file) return
    input.value = ''
    setStep(0)

    const prepared = await compressImage(file)
    const transfer = new DataTransfer()
    transfer.items.add(prepared)

    if (!payloadRef.current) return
    payloadRef.current.files = transfer.files
    formRef.current?.requestSubmit()
  }

  if (pending) {
    return (
      <div className="rounded-card border border-line bg-paper-raised p-7 animate-in">
        <p className="mb-6 font-display text-lg text-ink">{t('doc.analyzing')}</p>
        <StepProgress
          steps={[t('doc.analyzing.step1'), t('doc.analyzing.step2'), t('doc.analyzing.step3')]}
          active={step}
        />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Trägt die komprimierte Datei und wird von React abgeschickt. */}
      <form ref={formRef} action={action} className="hidden">
        <input ref={payloadRef} type="file" name="file" />
      </form>

      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(event) => void pick(event.currentTarget)}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => void pick(event.currentTarget)}
      />

      <button
        type="button"
        onClick={() => cameraRef.current?.click()}
        className="flex w-full flex-col items-center rounded-card border border-dashed border-line-strong bg-paper-raised px-6 py-12 transition-colors hover:border-alubali/40 hover:bg-alubali-tint"
      >
        <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-alubali-soft text-alubali">
          <Camera className="size-7" strokeWidth={1.4} />
        </span>
        <span className="font-display text-[1.05rem] text-ink">{t('action.takePhoto')}</span>
        <span className="mt-1 text-sm text-ink-muted">{t('doc.upload.hint')}</span>
      </button>

      <Button tone="secondary" full type="button" onClick={() => fileRef.current?.click()}>
        <FolderOpen className="size-4" />
        {t('action.chooseFile')}
      </Button>

      {state.error ? (
        <ErrorState
          title={
            state.error === 'too_large'
              ? t('error.upload.tooLarge')
              : state.error === 'wrong_type'
                ? t('error.upload.wrongType')
                : t('error.ai.failed')
          }
          hint={state.error === 'failed' ? t('error.generic.hint') : undefined}
        />
      ) : null}
    </div>
  )
}
