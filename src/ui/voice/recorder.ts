/**
 * Aufnahme im Browser.
 *
 * Die iOS-Eigenheiten sind hier gekapselt, nicht in der UI:
 *  * Safari kann kein `audio/webm;codecs=opus` — es liefert `audio/mp4`.
 *  * `MediaRecorder` existiert erst ab iOS 14.3.
 *  * `getUserMedia` verlangt HTTPS und eine Nutzergeste.
 *
 * Ist gar nichts davon verfügbar, meldet `isRecordingSupported()` false und die
 * UI zeigt statt des Mikrofons einen Datei-Upload mit `capture`-Attribut. Es
 * gibt keinen Zustand, in dem sie nichts tun kann.
 */

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
]

export function isRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== 'undefined'
  )
}

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined
  return MIME_CANDIDATES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type)
    } catch {
      return false
    }
  })
}

export type RecorderError = 'permission' | 'unsupported' | 'failed'

export interface RecorderHandle {
  stop: () => Promise<Blob>
  cancel: () => void
  /** Momentaner Pegel 0–1, für die Wellenform. */
  level: () => number
}

export interface StartOptions {
  /** Wird gerufen, wenn N Millisekunden Stille erkannt wurden. */
  onSilence?: () => void
  silenceMs?: number
}

export async function startRecording(options: StartOptions = {}): Promise<RecorderHandle> {
  if (!isRecordingSupported()) {
    throw Object.assign(new Error('Aufnahme nicht unterstützt'), { code: 'unsupported' as const })
  }

  let stream: MediaStream
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    const code = name === 'NotAllowedError' || name === 'SecurityError' ? 'permission' : 'failed'
    throw Object.assign(new Error('Mikrofon nicht verfügbar'), { code })
  }

  const mimeType = pickMimeType()
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  // Pegelmessung für die Wellenform und die Stille-Erkennung.
  const audioContext = new AudioContext()
  const source = audioContext.createMediaStreamSource(stream)
  const analyser = audioContext.createAnalyser()
  analyser.fftSize = 512
  source.connect(analyser)
  const buffer = new Uint8Array(analyser.frequencyBinCount)

  let currentLevel = 0
  let silenceSince: number | null = null
  let silenceFired = false
  const silenceMs = options.silenceMs ?? 2500
  const startedAt = Date.now()

  const meter = window.setInterval(() => {
    analyser.getByteTimeDomainData(buffer)
    let sum = 0
    for (const value of buffer) {
      const centered = (value - 128) / 128
      sum += centered * centered
    }
    currentLevel = Math.min(1, Math.sqrt(sum / buffer.length) * 4)

    if (!options.onSilence || silenceFired) return
    // Erst nach 1,5 s überhaupt auf Stille achten — sonst stoppt es beim Luftholen.
    if (Date.now() - startedAt < 1500) return

    if (currentLevel < 0.045) {
      silenceSince ??= Date.now()
      if (Date.now() - silenceSince > silenceMs) {
        silenceFired = true
        options.onSilence()
      }
    } else {
      silenceSince = null
    }
  }, 100)

  const cleanup = () => {
    window.clearInterval(meter)
    stream.getTracks().forEach((track) => track.stop())
    void audioContext.close().catch(() => undefined)
  }

  recorder.start(250)

  return {
    level: () => currentLevel,
    cancel: () => {
      try {
        if (recorder.state !== 'inactive') recorder.stop()
      } finally {
        cleanup()
      }
    },
    stop: () =>
      new Promise<Blob>((resolve) => {
        recorder.onstop = () => {
          cleanup()
          resolve(new Blob(chunks, { type: mimeType ?? 'audio/webm' }))
        }
        if (recorder.state === 'inactive') {
          cleanup()
          resolve(new Blob(chunks, { type: mimeType ?? 'audio/webm' }))
        } else {
          recorder.stop()
        }
      }),
  }
}

export function extensionForBlob(blob: Blob): string {
  if (blob.type.includes('mp4') || blob.type.includes('aac')) return 'm4a'
  if (blob.type.includes('ogg')) return 'ogg'
  return 'webm'
}
