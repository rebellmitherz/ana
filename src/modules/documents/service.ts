import 'server-only'

import { createHash, randomUUID } from 'node:crypto'

import { runStructured } from '@/core/ai'
import { getScopedStore } from '@/core/db'
import type { DocumentAnalysis, DocumentRow, Id } from '@/core/db/types'
import type { Session } from '@/core/auth/session'
import { putObject } from '@/core/storage'
import { recordAiUsage } from '@/modules/audit'
import { documentAnalysisSchema } from '@/modules/assistant/schemas'
import { DOCUMENT_SYSTEM, contextPreamble } from '@/modules/assistant/prompts'
import { normalizeDate } from '@/modules/assistant/normalize'

/**
 * WOW 1 — deutschen Brief verstehen.
 *
 * Bewusst KEIN separates OCR: Ein Vision-Modell liest deutsche Briefköpfe,
 * Tabellen und Fristen in einem Schritt besser als OCR plus Textmodell — und
 * billiger, weil es nur ein Aufruf ist.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

const ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
])

export class UploadError extends Error {
  constructor(readonly reason: 'too_large' | 'wrong_type') {
    super(reason)
    this.name = 'UploadError'
  }
}

function extensionFor(mimeType: string): string {
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'application/pdf': 'pdf',
  }
  return map[mimeType] ?? 'bin'
}

export async function explainDocument(
  session: Session,
  file: File,
  options: { ownerKind?: DocumentRow['owner_kind']; ownerId?: Id } = {},
): Promise<DocumentRow> {
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('too_large')
  if (!ACCEPTED_TYPES.has(file.type)) throw new UploadError('wrong_type')

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const hash = createHash('sha256').update(buffer).digest('hex')

  const store = await getScopedStore(session.orgId)

  // Denselben Brief zweimal fotografieren kostet nur einmal.
  const existing = await store.list('documents', { where: { content_hash: hash }, limit: 1 })
  if (existing[0]?.analysis) return existing[0]

  const objectPath = `${session.orgId}/documents/${randomUUID()}.${extensionFor(file.type)}`
  await putObject(objectPath, bytes, file.type)

  // PDFs kann das Vision-Modell nicht als Bild entgegennehmen — für V1 wird
  // die Datei gespeichert und ohne Analyse abgelegt, statt zu scheitern.
  const isImage = file.type.startsWith('image/')
  let analysis: DocumentAnalysis | null = null

  if (isImage) {
    const result = await runStructured(
      {
        task: 'document.explain',
        system: `${DOCUMENT_SYSTEM}\n\n${contextPreamble()}`,
        user: 'Erkläre diesen Brief. Antworte ausschließlich im vorgegebenen Format.',
        images: [{ mimeType: file.type, base64: buffer.toString('base64') }],
        schema: documentAnalysisSchema,
        schemaName: 'document_explanation',
        schemaDescription: 'Strukturierte Erklärung eines deutschen Dokuments',
        maxOutputTokens: 2500,
      },
      {
        onUsage: async (entry) =>
          recordAiUsage(session, { ...entry, toolName: 'explainGermanDocument' }),
      },
    )

    const parsed = result.data
    analysis = {
      document_type: parsed.document_type,
      sender: parsed.sender,
      subject_ka: parsed.subject_ka,
      summary_ka: parsed.summary_ka,
      what_they_want_ka: parsed.what_they_want_ka,
      action_required: parsed.action_required,
      deadline: parsed.deadline?.date
        ? {
            date: normalizeDate(parsed.deadline.date) ?? parsed.deadline.date,
            what_ka: parsed.deadline.what_ka,
          }
        : null,
      next_steps_ka: parsed.next_steps_ka.slice(0, 4),
      important_ka: parsed.important_ka ?? null,
      amounts: (parsed.amounts ?? []).map((entry) => ({
        label_ka: entry.label_ka,
        amount_eur: entry.amount_eur,
      })),
      advisory_level: parsed.advisory_level,
      original_excerpt: parsed.original_excerpt ?? null,
    }
  }

  return store.insert('documents', {
    owner_kind: options.ownerKind ?? null,
    owner_id: options.ownerId ?? null,
    kind: 'letter',
    storage_path: objectPath,
    file_name: file.name || 'brief',
    mime_type: file.type,
    size_bytes: file.size,
    content_hash: hash,
    expires_at: null,
    analysis,
    is_demo: false,
  })
}

export async function getDocument(session: Session, id: Id): Promise<DocumentRow | null> {
  const store = await getScopedStore(session.orgId)
  return store.get('documents', id)
}

export async function listDocuments(session: Session, limit = 20): Promise<DocumentRow[]> {
  const store = await getScopedStore(session.orgId)
  return store.list('documents', {
    orderBy: { column: 'created_at', ascending: false },
    limit,
  })
}

/** Tage bis zur Frist. Negativ = abgelaufen. Rein rechnerisch, kein AI. */
export function daysUntil(date: string | null | undefined): number | null {
  if (!date) return null
  const target = new Date(`${date}T00:00:00`)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}
