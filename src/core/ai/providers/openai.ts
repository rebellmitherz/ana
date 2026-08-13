import { AiError, type LLMProvider, type ProviderResponse, type StructuredRequest } from '../types'
import { env } from '@/core/config/env'

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[]
  usage?: { prompt_tokens?: number; completion_tokens?: number }
  error?: { message?: string }
}

/**
 * OpenAI Chat Completions als Fallback-Provider.
 *
 * Bewusst JSON-Modus statt `strict: true` json_schema: Der strikte Modus
 * verlangt, dass jedes Feld required und `additionalProperties: false` ist —
 * das kollidiert mit optionalen Feldern in unseren Schemas. JSON-Modus plus
 * Zod-Validierung mit Reparaturversuch ist robuster über Modellversionen hinweg.
 */
export const openaiProvider: LLMProvider = {
  id: 'openai',
  supportsVision: true,

  async generate<T>(
    request: StructuredRequest<T>,
    model: string,
    jsonSchema: Record<string, unknown>,
    repairHint?: string,
  ): Promise<ProviderResponse> {
    const apiKey = env.ai.openaiKey
    if (!apiKey) throw new AiError('OPENAI_API_KEY fehlt', 'provider')

    const userContent: Record<string, unknown>[] = []
    for (const image of request.images ?? []) {
      userContent.push({
        type: 'image_url',
        image_url: { url: `data:${image.mimeType};base64,${image.base64}` },
      })
    }
    userContent.push({
      type: 'text',
      text: repairHint ? `${request.user}\n\n${repairHint}` : request.user,
    })

    const system = [
      request.system,
      '',
      'Antworte ausschließlich mit einem JSON-Objekt, das exakt diesem JSON-Schema entspricht.',
      'Kein Fließtext, keine Code-Fences, keine Erklärung.',
      JSON.stringify(jsonSchema),
    ].join('\n')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          max_tokens: request.maxOutputTokens ?? 2048,
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: userContent },
          ],
        }),
      })

      const body = (await response.json()) as OpenAiResponse

      if (!response.ok) {
        throw new AiError(`OpenAI ${response.status}: ${body.error?.message ?? 'unbekannt'}`, 'provider')
      }

      const text = body.choices?.[0]?.message?.content
      if (!text) throw new AiError('OpenAI lieferte keinen Inhalt', 'schema')

      return {
        raw: text,
        inputTokens: body.usage?.prompt_tokens ?? 0,
        outputTokens: body.usage?.completion_tokens ?? 0,
      }
    } catch (error) {
      if (error instanceof AiError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiError('OpenAI Zeitüberschreitung', 'timeout', error)
      }
      throw new AiError('OpenAI nicht erreichbar', 'provider', error)
    } finally {
      clearTimeout(timeout)
    }
  },
}
