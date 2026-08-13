import { AiError, type LLMProvider, type ProviderResponse, type StructuredRequest } from '../types'
import { env } from '@/core/config/env'

interface AnthropicContentBlock {
  type: string
  name?: string
  input?: unknown
  text?: string
}

interface AnthropicResponse {
  content?: AnthropicContentBlock[]
  usage?: { input_tokens?: number; output_tokens?: number }
  error?: { message?: string }
}

/**
 * Anthropic Messages API mit erzwungenem Tool-Use.
 *
 * Tool-Use ist der zuverlässigste Weg zu strukturierter Ausgabe: Das Modell
 * bekommt das JSON-Schema als Tool-Definition und wird per `tool_choice`
 * gezwungen, es zu benutzen. Kein Parsen von Freitext.
 */
export const anthropicProvider: LLMProvider = {
  id: 'anthropic',
  supportsVision: true,

  async generate<T>(
    request: StructuredRequest<T>,
    model: string,
    jsonSchema: Record<string, unknown>,
    repairHint?: string,
  ): Promise<ProviderResponse> {
    const apiKey = env.ai.anthropicKey
    if (!apiKey) throw new AiError('ANTHROPIC_API_KEY fehlt', 'provider')

    const content: Record<string, unknown>[] = []
    for (const image of request.images ?? []) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: image.mimeType, data: image.base64 },
      })
    }
    content.push({
      type: 'text',
      text: repairHint ? `${request.user}\n\n${repairHint}` : request.user,
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60_000)

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model,
          max_tokens: request.maxOutputTokens ?? 2048,
          system: request.system,
          messages: [{ role: 'user', content }],
          tools: [
            {
              name: request.schemaName,
              description: request.schemaDescription ?? 'Strukturierte Ausgabe',
              input_schema: jsonSchema,
            },
          ],
          tool_choice: { type: 'tool', name: request.schemaName },
        }),
      })

      const body = (await response.json()) as AnthropicResponse

      if (!response.ok) {
        throw new AiError(
          `Anthropic ${response.status}: ${body.error?.message ?? 'unbekannt'}`,
          'provider',
        )
      }

      const toolBlock = body.content?.find((block) => block.type === 'tool_use')
      if (!toolBlock || toolBlock.input === undefined) {
        throw new AiError('Anthropic lieferte keinen Tool-Aufruf', 'schema')
      }

      return {
        raw: toolBlock.input,
        inputTokens: body.usage?.input_tokens ?? 0,
        outputTokens: body.usage?.output_tokens ?? 0,
      }
    } catch (error) {
      if (error instanceof AiError) throw error
      if (error instanceof Error && error.name === 'AbortError') {
        throw new AiError('Anthropic Zeitüberschreitung', 'timeout', error)
      }
      throw new AiError('Anthropic nicht erreichbar', 'provider', error)
    } finally {
      clearTimeout(timeout)
    }
  },
}
