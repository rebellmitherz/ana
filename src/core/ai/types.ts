import type { z } from 'zod'

/** Aufgaben-Kennung. Der Router bildet sie auf Tier und Modell ab. */
export type AiTask =
  | 'assistant.route'
  | 'caregiver.extract'
  | 'family.extract'
  | 'document.explain'
  | 'message.draft'
  | 'translate'
  | 'search.filter'

export type ModelTier = 'nano' | 'standard' | 'vision'

export interface AiImage {
  mimeType: string
  /** Base64 ohne data:-Präfix. */
  base64: string
}

export interface StructuredRequest<T> {
  task: AiTask
  system: string
  user: string
  images?: AiImage[]
  schema: z.ZodType<T>
  schemaName: string
  schemaDescription?: string
  /** Overrides das vom Router gewählte Tier (z. B. Vision bei Bildern). */
  tier?: ModelTier
  maxOutputTokens?: number
}

export interface AiUsage {
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
}

export interface AiResult<T> {
  data: T
  usage: AiUsage
  provider: string
  model: string
  cacheHit: boolean
}

/** Rohantwort eines Providers, bevor sie gegen das Schema validiert wird. */
export interface ProviderResponse {
  /** JSON-Text oder bereits geparstes Objekt. */
  raw: unknown
  inputTokens: number
  outputTokens: number
}

export interface LLMProvider {
  readonly id: 'anthropic' | 'openai' | 'mock'
  readonly supportsVision: boolean
  generate<T>(
    request: StructuredRequest<T>,
    model: string,
    jsonSchema: Record<string, unknown>,
    repairHint?: string,
  ): Promise<ProviderResponse>
}

export class AiError extends Error {
  constructor(
    message: string,
    readonly code: 'provider' | 'schema' | 'budget' | 'timeout',
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AiError'
  }
}
