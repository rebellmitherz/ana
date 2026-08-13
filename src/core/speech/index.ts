import 'server-only'

import { env } from '@/core/config/env'

/**
 * Speech-to-Text hinter einem austauschbaren Adapter.
 *
 * Georgisch ist eine ressourcenarme Sprache — welcher Anbieter am besten
 * transkribiert, ist eine empirische Frage, die ein Benchmark mit echten
 * Aufnahmen beantworten muss (docs/ROADMAP.md, M0.1). Diese Schicht existiert
 * genau deshalb: Der Wechsel ist eine Zeile Konfiguration, kein Refactoring.
 *
 * `vocabulary` ist der wichtigste Parameter: Die Namen aus der eigenen
 * Datenbank werden als Bias übergeben, damit aus „Nino" nicht „Nina" wird.
 */

export interface TranscribeRequest {
  audio: Blob
  languageHint?: 'ka' | 'de' | 'ru' | 'en'
  /** Eigennamen aus der Datenbank — deutlich bessere Erkennung von Namen. */
  vocabulary?: string[]
}

export interface TranscribeResult {
  text: string
  language: string
  durationSec: number
  provider: string
  /** Nur gesetzt, wenn der Anbieter es liefert. */
  confidence?: number
}

export interface SpeechProvider {
  readonly id: 'openai' | 'mock'
  transcribe(request: TranscribeRequest): Promise<TranscribeResult>
}

export class SpeechError extends Error {
  constructor(
    message: string,
    readonly code: 'provider' | 'empty' | 'unsupported',
  ) {
    super(message)
    this.name = 'SpeechError'
  }
}

// ---------------------------------------------------------------------------

const openaiSpeech: SpeechProvider = {
  id: 'openai',

  async transcribe({ audio, languageHint, vocabulary }): Promise<TranscribeResult> {
    const apiKey = env.speech.openaiKey
    if (!apiKey) throw new SpeechError('OPENAI_API_KEY fehlt', 'provider')

    const form = new FormData()
    form.append('file', audio, 'aufnahme.webm')
    form.append('model', env.speech.model)
    if (languageHint) form.append('language', languageHint)
    if (vocabulary?.length) {
      // Namensbias: der Prompt-Parameter wirkt als schwaches Sprachmodell-Prior.
      form.append('prompt', vocabulary.slice(0, 60).join(', '))
    }

    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    })

    if (!response.ok) {
      const detail = await response.text()
      throw new SpeechError(`OpenAI ${response.status}: ${detail.slice(0, 200)}`, 'provider')
    }

    const body = (await response.json()) as { text?: string; duration?: number }
    const text = (body.text ?? '').trim()
    if (!text) throw new SpeechError('Leeres Transkript', 'empty')

    return {
      text,
      language: languageHint ?? 'ka',
      durationSec: body.duration ?? 0,
      provider: 'openai',
    }
  },
}

/**
 * Mock-Transkription für den Demo-Modus.
 *
 * Rotiert über realistische georgische Äußerungen, damit jeder Voice-Flow ohne
 * Mikrofon und ohne API-Key vollständig durchspielbar ist.
 */
const MOCK_UTTERANCES = [
  'ნინო არის 47 წლის, აქვს რვა წლის გამოცდილება, ლაპარაკობს A2 დონეზე გერმანულად, იცნობს დემენციას და შეუძლია 1 სექტემბრიდან დაიწყოს.',
  'თამარი 52 წლისაა, თორმეტი წლის გამოცდილება აქვს, გერმანული B1, მუშაობდა წოლით რეჟიმში მყოფ ადამიანებთან და თავისუფალია 15 ოქტომბრიდან.',
  'ერთი ოჯახი დამირეკა მიუნხენიდან. დედა 82 წლისაა, დაწყებითი დემენცია აქვს, დამოუკიდებლად მოძრაობს და მარტო ცხოვრობს. სექტემბრიდან სჭირდებათ.',
  'შემახსენე, რომ ხვალ დავურეკო ქალბატონ მიულერს.',
  'დღეს კარგი დღე იყო. ბევრი ვიმუშავე, მაგრამ საღამოს მეგობრებთან ვიყავი.',
]

const mockSpeech: SpeechProvider = {
  id: 'mock',

  async transcribe({ audio }): Promise<TranscribeResult> {
    await new Promise((resolve) => setTimeout(resolve, 700 + Math.random() * 600))

    // Deterministisch über die Aufnahmegröße — gleiche Aufnahme, gleiches Ergebnis.
    const index = audio.size % MOCK_UTTERANCES.length
    return {
      text: MOCK_UTTERANCES[index] ?? MOCK_UTTERANCES[0]!,
      language: 'ka',
      durationSec: Math.max(4, Math.round(audio.size / 4000)),
      provider: 'mock',
      confidence: 0.9,
    }
  },
}

const PROVIDERS: Record<'openai' | 'mock', SpeechProvider> = {
  openai: openaiSpeech,
  mock: mockSpeech,
}

export async function transcribe(request: TranscribeRequest): Promise<TranscribeResult> {
  const provider = PROVIDERS[env.speech.provider]
  try {
    return await provider.transcribe(request)
  } catch (error) {
    // Ohne Netz oder mit ungültigem Key darf der Flow nicht sterben —
    // der Mock hält die App benutzbar und die Nutzerin sieht einen klaren Zustand.
    if (provider.id !== 'mock') {
      console.error('[speech] Provider gescheitert, weiche auf Mock aus:', error)
      return mockSpeech.transcribe(request)
    }
    throw error
  }
}

/**
 * Text-to-Speech ist in V1 bewusst nicht implementiert.
 *
 * Georgische Stimmen sind rar und uneinheitlich; eine schlechte Roboterstimme in
 * der Muttersprache würde die Premium-Wirkung sofort zerstören. Die Schnittstelle
 * steht, damit sie nachgerüstet werden kann, sobald eine gute Stimme feststeht.
 */
export async function textToSpeech(): Promise<never> {
  throw new SpeechError('Text-to-Speech ist in V1 nicht aktiv', 'unsupported')
}
