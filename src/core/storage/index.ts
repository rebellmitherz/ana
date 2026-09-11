import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'

import { env } from '@/core/config/env'
import { createSupabaseClient } from '@/core/db/supabase-store'

/**
 * Dateiablage.
 *
 * Regeln, die in beiden Treibern gelten:
 *  * Nichts ist öffentlich lesbar.
 *  * Zugriffe laufen immer über eine serverseitige Prüfung der Sitzung.
 *  * Der erste Pfadabschnitt ist die Organisation — daran hängt die Grenze.
 */

const BUCKET = 'documents'
// Auf Vercel ist nur /tmp beschreibbar (siehe local-store.ts) — gleicher Grund.
const LOCAL_ROOT = process.env.VERCEL
  ? path.join('/tmp', 'alubali-data', 'uploads')
  : path.join(process.cwd(), '.data', 'uploads')

export interface StoredObject {
  path: string
  size: number
  contentType: string
}

function assertSafePath(objectPath: string): void {
  if (objectPath.includes('..') || path.isAbsolute(objectPath)) {
    throw new Error('Ungültiger Objektpfad')
  }
}

export async function putObject(
  objectPath: string,
  data: ArrayBuffer,
  contentType: string,
): Promise<StoredObject> {
  assertSafePath(objectPath)

  if (env.supabase.configured) {
    const client = await createSupabaseClient()
    const { error } = await client.storage
      .from(BUCKET)
      .upload(objectPath, data, { contentType, upsert: false })
    if (error) throw new Error(`[storage] Upload fehlgeschlagen: ${error.message}`)
    return { path: objectPath, size: data.byteLength, contentType }
  }

  const target = path.join(LOCAL_ROOT, objectPath)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, Buffer.from(data))
  return { path: objectPath, size: data.byteLength, contentType }
}

export async function readObject(objectPath: string): Promise<{ data: Buffer; contentType: string } | null> {
  assertSafePath(objectPath)

  if (env.supabase.configured) {
    const client = await createSupabaseClient()
    const { data, error } = await client.storage.from(BUCKET).download(objectPath)
    if (error || !data) return null
    return { data: Buffer.from(await data.arrayBuffer()), contentType: data.type }
  }

  try {
    const target = path.join(LOCAL_ROOT, objectPath)
    const data = await fs.readFile(target)
    return { data, contentType: guessContentType(objectPath) }
  } catch {
    return null
  }
}

/**
 * Kurzlebige URL für ein Objekt.
 *
 * Bei Supabase eine echte Signed URL mit 60 Sekunden Gültigkeit. Lokal ein
 * interner Endpunkt, der die Sitzung prüft — nie ein direkter Dateipfad.
 */
export async function getObjectUrl(objectPath: string): Promise<string | null> {
  assertSafePath(objectPath)

  if (env.supabase.configured) {
    const client = await createSupabaseClient()
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(objectPath, 60)
    if (error || !data) return null
    return data.signedUrl
  }

  return `/api/files/${objectPath.split('/').map(encodeURIComponent).join('/')}`
}

export async function deleteObject(objectPath: string): Promise<void> {
  assertSafePath(objectPath)

  if (env.supabase.configured) {
    const client = await createSupabaseClient()
    await client.storage.from(BUCKET).remove([objectPath])
    return
  }

  try {
    await fs.unlink(path.join(LOCAL_ROOT, objectPath))
  } catch {
    // Bereits weg — das ist der gewünschte Endzustand.
  }
}

/** Löscht alle Objekte einer Organisation. Teil des Löschkonzepts. */
export async function deleteOrgObjects(orgId: string): Promise<void> {
  if (env.supabase.configured) {
    const client = await createSupabaseClient()
    const { data } = await client.storage.from(BUCKET).list(orgId)
    if (data?.length) {
      await client.storage.from(BUCKET).remove(data.map((file) => `${orgId}/${file.name}`))
    }
    return
  }

  try {
    await fs.rm(path.join(LOCAL_ROOT, orgId), { recursive: true, force: true })
  } catch {
    /* nichts zu tun */
  }
}

function guessContentType(objectPath: string): string {
  const extension = path.extname(objectPath).toLowerCase()
  const map: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.pdf': 'application/pdf',
    '.webm': 'audio/webm',
    '.mp4': 'audio/mp4',
    '.m4a': 'audio/mp4',
  }
  return map[extension] ?? 'application/octet-stream'
}
