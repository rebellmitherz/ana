import 'server-only'

import { getScopedStore } from '@/core/db'
import type { EntityKind, Id } from '@/core/db/types'
import type { Session } from '@/core/auth/session'

/**
 * Audit und Kostentelemetrie.
 *
 * Zwei Regeln:
 *  1. `ai_interactions` enthält NUR Zahlen — niemals Prompt, Transkript oder
 *     Ergebnis. Was hier landet, darf in jedem Log stehen.
 *  2. Für Gesundheitsdaten werden im Audit nur Spaltennamen protokolliert,
 *     nie Werte (`redactValues`).
 */

const REDACTED_TABLES = new Set(['care_case_health'])

export async function recordAiUsage(
  session: Session,
  entry: {
    task: string
    provider: string
    model: string
    tier: string
    inputTokens: number
    outputTokens: number
    costUsd: number
    latencyMs: number
    cacheHit: boolean
    success: boolean
    errorCode: string | null
    toolName?: string | null
    audioSeconds?: number | null
  },
): Promise<void> {
  try {
    const store = await getScopedStore(session.orgId)
    await store.insert('ai_interactions', {
      kind: entry.task,
      provider: entry.provider,
      model: entry.model,
      tier: entry.tier,
      input_tokens: entry.inputTokens,
      output_tokens: entry.outputTokens,
      audio_seconds: entry.audioSeconds ?? null,
      cost_usd: entry.costUsd,
      latency_ms: entry.latencyMs,
      tool_name: entry.toolName ?? null,
      cache_hit: entry.cacheHit,
      success: entry.success,
      error_code: entry.errorCode,
    })
  } catch (error) {
    // Telemetrie darf niemals einen Nutzerflow zum Scheitern bringen.
    console.error('[telemetry] konnte Nutzung nicht protokollieren:', error)
  }
}

export async function recordAudit(
  session: Session,
  entry: {
    table: string
    rowId: Id
    op: 'INSERT' | 'UPDATE' | 'DELETE'
    changed?: Record<string, unknown> | null
  },
): Promise<void> {
  try {
    const store = await getScopedStore(session.orgId)
    const redact = REDACTED_TABLES.has(entry.table)
    const changed = entry.changed
      ? redact
        ? Object.fromEntries(Object.keys(entry.changed).map((key) => [key, '[redacted]']))
        : entry.changed
      : null

    await store.insert('audit_logs', {
      actor_id: session.userId,
      table_name: entry.table,
      row_id: entry.rowId,
      op: entry.op,
      changed_fields: changed,
    })
  } catch (error) {
    console.error('[audit] konnte Änderung nicht protokollieren:', error)
  }
}

/** Feldweiser Vergleich für UPDATE-Einträge. `updated_at` wird ignoriert. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
): Record<string, unknown> | null {
  const changed: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(after)) {
    if (key === 'updated_at') continue
    if (JSON.stringify(before[key]) !== JSON.stringify(value)) {
      changed[key] = [before[key], value]
    }
  }
  return Object.keys(changed).length > 0 ? changed : null
}

export async function listAuditForEntity(
  session: Session,
  kind: EntityKind,
  id: Id,
): Promise<{ at: string; table: string; op: string; changed: Record<string, unknown> | null }[]> {
  const store = await getScopedStore(session.orgId)
  const tableForKind: Record<EntityKind, string> = {
    caregiver: 'caregivers',
    family: 'families',
    care_case: 'care_cases',
    placement: 'placements',
  }

  const rows = await store.list('audit_logs', {
    where: { table_name: tableForKind[kind], row_id: id },
    orderBy: { column: 'created_at', ascending: false },
    limit: 20,
  })

  return rows.map((row) => ({
    at: row.created_at,
    table: row.table_name,
    op: row.op,
    changed: row.changed_fields,
  }))
}
