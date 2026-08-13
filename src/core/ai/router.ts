import { env } from '@/core/config/env'
import type { AiTask, ModelTier } from './types'

/**
 * Model Router.
 *
 * Der Business Code nennt nie einen Anbieter oder ein Modell — er nennt eine
 * Aufgabe. Damit ist ein Providerwechsel eine Konfigurationsänderung.
 *
 * Opus wird in dieser Anwendung bewusst nie verwendet: keine der Aufgaben
 * rechtfertigt die Kosten (siehe docs/ARCHITECTURE.md, C.4).
 */

const TASK_TIER: Record<AiTask, ModelTier> = {
  'assistant.route': 'nano',
  'caregiver.extract': 'nano',
  'family.extract': 'nano',
  'search.filter': 'nano',
  'document.explain': 'vision',
  'message.draft': 'standard',
  translate: 'standard',
}

const DEFAULT_MODELS: Record<'anthropic' | 'openai' | 'mock', Record<ModelTier, string>> = {
  anthropic: {
    nano: 'claude-haiku-4-5-20251001',
    standard: 'claude-sonnet-5',
    vision: 'claude-sonnet-5',
  },
  openai: {
    nano: 'gpt-4o-mini',
    standard: 'gpt-4o',
    vision: 'gpt-4o',
  },
  mock: { nano: 'mock-nano', standard: 'mock-standard', vision: 'mock-vision' },
}

/** USD pro einer Million Tokens. Grobe Größenordnung für die Kostentelemetrie. */
const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  'claude-sonnet-5': { input: 3, output: 15 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
}

export function tierForTask(task: AiTask): ModelTier {
  return TASK_TIER[task]
}

export function modelFor(provider: 'anthropic' | 'openai' | 'mock', tier: ModelTier): string {
  const override = env.ai.models[tier]
  if (override && provider !== 'mock') return override
  return DEFAULT_MODELS[provider][tier]
}

export function estimateCostUsd(model: string, inputTokens: number, outputTokens: number): number {
  const price = PRICING[model]
  if (!price) return 0
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000
}
