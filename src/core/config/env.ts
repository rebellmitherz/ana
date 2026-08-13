import { z } from 'zod'

/**
 * Zentrale, validierte Umgebungskonfiguration.
 *
 * Leitprinzip: ALUBALI muss ohne jede Variable startbar sein. Fehlt etwas,
 * fällt der jeweilige Bereich auf einen Mock/Demo-Adapter zurück — die App
 * blockiert nie wegen fehlender Keys.
 */

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : undefined))

const serverSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: optionalString,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optionalString,
  SUPABASE_SERVICE_ROLE_KEY: optionalString,

  AI_PROVIDER: z.enum(['anthropic', 'openai', 'mock']).optional(),
  ANTHROPIC_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  AI_MODEL_NANO: optionalString,
  AI_MODEL_STANDARD: optionalString,
  AI_MODEL_VISION: optionalString,

  SPEECH_PROVIDER: z.enum(['openai', 'mock']).optional(),
  SPEECH_MODEL: optionalString,

  NEXT_PUBLIC_APP_URL: optionalString,
  SEED_DEMO_DATA: optionalString,
  AI_MONTHLY_BUDGET_USD: optionalString,
  DEMO_SESSION_SECRET: optionalString,
})

const parsed = serverSchema.safeParse(process.env)

if (!parsed.success) {
  // Sollte praktisch nie passieren, da alles optional ist — aber wenn doch,
  // dann laut und beim Start, nicht still zur Laufzeit.
  console.error('[env] Ungültige Umgebungskonfiguration:', parsed.error.issues)
  throw new Error('Ungültige Umgebungskonfiguration')
}

const raw = parsed.data

function pickAiProvider(): 'anthropic' | 'openai' | 'mock' {
  if (raw.AI_PROVIDER === 'anthropic' && raw.ANTHROPIC_API_KEY) return 'anthropic'
  if (raw.AI_PROVIDER === 'openai' && raw.OPENAI_API_KEY) return 'openai'
  if (raw.AI_PROVIDER === 'mock') return 'mock'
  if (raw.ANTHROPIC_API_KEY) return 'anthropic'
  if (raw.OPENAI_API_KEY) return 'openai'
  return 'mock'
}

function pickSpeechProvider(): 'openai' | 'mock' {
  if (raw.SPEECH_PROVIDER === 'openai' && raw.OPENAI_API_KEY) return 'openai'
  if (raw.SPEECH_PROVIDER === 'mock') return 'mock'
  if (raw.OPENAI_API_KEY) return 'openai'
  return 'mock'
}

const supabaseConfigured = Boolean(
  raw.NEXT_PUBLIC_SUPABASE_URL && raw.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

export const env = {
  app: {
    url: raw.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
    seedDemoData: raw.SEED_DEMO_DATA !== 'false',
    demoSessionSecret: raw.DEMO_SESSION_SECRET ?? 'alubali-local-demo-secret',
  },
  supabase: {
    configured: supabaseConfigured,
    url: raw.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: raw.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    serviceRoleKey: raw.SUPABASE_SERVICE_ROLE_KEY,
  },
  ai: {
    provider: pickAiProvider(),
    anthropicKey: raw.ANTHROPIC_API_KEY,
    openaiKey: raw.OPENAI_API_KEY,
    models: {
      nano: raw.AI_MODEL_NANO,
      standard: raw.AI_MODEL_STANDARD,
      vision: raw.AI_MODEL_VISION,
    },
    monthlyBudgetUsd: Number(raw.AI_MONTHLY_BUDGET_USD ?? '25'),
  },
  speech: {
    provider: pickSpeechProvider(),
    openaiKey: raw.OPENAI_API_KEY,
    model: raw.SPEECH_MODEL ?? 'gpt-4o-transcribe',
  },
} as const

/** Läuft die App gerade vollständig ohne externe Dienste? */
export const isDemoMode = !supabaseConfigured

export type Env = typeof env
