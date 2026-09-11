import 'server-only'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'

import { TABLE_NAMES, type Id, type Row, type TableName } from './types'
import {
  matchesWhere,
  NotFoundError,
  type Insert,
  type Patch,
  type Query,
  type Store,
  type WhereClause,
} from './store'

/**
 * Dateibasierter Datenspeicher für den Demo-Modus.
 *
 * Zweck: ALUBALI muss ohne Supabase-Keys vollständig lauffähig sein — jeder
 * Flow klickbar, jede Speicherung echt. Das ist kein Spielzeug-Stub, sondern
 * ein vollwertiger Treiber hinter demselben Port wie Supabase.
 *
 * Nicht gedacht für: Nebenläufigkeit über mehrere Prozesse, große Datenmengen.
 *
 * Serverless-Hinweis: Auf Vercel (und vergleichbaren Plattformen) ist das
 * Projektverzeichnis zur Laufzeit schreibgeschützt — nur `/tmp` ist
 * beschreibbar. Dort landet der Speicher dann automatisch. Wichtig zu wissen:
 * `/tmp` ist nicht garantiert dauerhaft — bei einem neuen Cold Start kann der
 * Container wechseln und der Inhalt zurückgesetzt werden. Für einen Demo-Link
 * ist das akzeptabel, für echte Daten braucht es Supabase.
 */

const DATA_DIR = process.env.VERCEL
  ? path.join('/tmp', 'alubali-data')
  : path.join(process.cwd(), '.data')
const DATA_FILE = path.join(DATA_DIR, 'store.json')

type Snapshot = Record<string, Record<string, unknown>[]>

interface LocalStoreState {
  data: Snapshot
  loaded: boolean
  writeQueue: Promise<void>
}

// Übersteht Hot Reload im Entwicklungsmodus.
const globalRef = globalThis as unknown as { __alubaliLocalStore?: LocalStoreState }

function state(): LocalStoreState {
  if (!globalRef.__alubaliLocalStore) {
    globalRef.__alubaliLocalStore = {
      data: Object.fromEntries(TABLE_NAMES.map((t) => [t, []])),
      loaded: false,
      writeQueue: Promise.resolve(),
    }
  }
  return globalRef.__alubaliLocalStore
}

async function ensureLoaded(): Promise<Snapshot> {
  const s = state()
  if (s.loaded) return s.data

  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Snapshot
    for (const table of TABLE_NAMES) {
      s.data[table] = Array.isArray(parsed[table]) ? parsed[table] : []
    }
  } catch {
    // Noch keine Datei — leerer Speicher ist der korrekte Startzustand.
  }
  s.loaded = true
  return s.data
}

function persist(): Promise<void> {
  const s = state()
  s.writeQueue = s.writeQueue
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true })
      await fs.writeFile(DATA_FILE, JSON.stringify(s.data, null, 2), 'utf8')
    })
    .catch((error: unknown) => {
      console.error('[local-store] Schreiben fehlgeschlagen:', error)
    })
  return s.writeQueue
}

function table<T extends TableName>(data: Snapshot, name: T): Row<T>[] {
  const rows = data[name]
  if (!rows) {
    data[name] = []
    return data[name] as unknown as Row<T>[]
  }
  return rows as unknown as Row<T>[]
}

function now(): string {
  return new Date().toISOString()
}

export const localStore: Store = {
  async list<T extends TableName>(name: T, query?: Query<Row<T>>): Promise<Row<T>[]> {
    const data = await ensureLoaded()
    let rows = table(data, name).filter((row) => matchesWhere(row, query?.where))

    if (!query?.includeDeleted) {
      rows = rows.filter((row) => !row.deleted_at)
    }

    const order = query?.orderBy
    if (order) {
      const dir = order.ascending === false ? -1 : 1
      rows = [...rows].sort((a, b) => {
        const av = (a as unknown as Record<string, unknown>)[order.column]
        const bv = (b as unknown as Record<string, unknown>)[order.column]
        if (av === bv) return 0
        if (av === null || av === undefined) return 1
        if (bv === null || bv === undefined) return -1
        return (av < bv ? -1 : 1) * dir
      })
    }

    return query?.limit ? rows.slice(0, query.limit) : rows
  },

  async get<T extends TableName>(name: T, id: Id): Promise<Row<T> | null> {
    const data = await ensureLoaded()
    return table(data, name).find((row) => row.id === id) ?? null
  },

  async insert<T extends TableName>(name: T, values: Insert<T>): Promise<Row<T>> {
    const data = await ensureLoaded()
    const timestamp = now()
    const row = {
      is_demo: false,
      deleted_at: null,
      ...values,
      id: (values as { id?: Id }).id ?? randomUUID(),
      created_at: timestamp,
      updated_at: timestamp,
    } as unknown as Row<T>

    table(data, name).push(row)
    await persist()
    return row
  },

  async update<T extends TableName>(name: T, id: Id, patch: Patch<T>): Promise<Row<T>> {
    const data = await ensureLoaded()
    const rows = table(data, name)
    const index = rows.findIndex((row) => row.id === id)
    if (index === -1) throw new NotFoundError(name, id)

    const existing = rows[index] as Row<T>
    const updated = { ...existing, ...patch, updated_at: now() } as Row<T>
    rows[index] = updated
    await persist()
    return updated
  },

  async softDelete<T extends TableName>(name: T, id: Id): Promise<void> {
    await this.update(name, id, { deleted_at: now() } as Patch<T>)
  },

  async hardDelete<T extends TableName>(name: T, id: Id): Promise<void> {
    const data = await ensureLoaded()
    const rows = table(data, name)
    const index = rows.findIndex((row) => row.id === id)
    if (index === -1) return
    rows.splice(index, 1)
    await persist()
  },

  async deleteWhere<T extends TableName>(name: T, where: WhereClause<Row<T>>): Promise<number> {
    const data = await ensureLoaded()
    const rows = table(data, name)
    const keep = rows.filter((row) => !matchesWhere(row, where))
    const removed = rows.length - keep.length
    data[name] = keep as unknown as Record<string, unknown>[]
    if (removed > 0) await persist()
    return removed
  },
}

/** Ist der lokale Speicher noch leer? Steuert das Anlegen der Demo-Daten. */
export async function isLocalStoreEmpty(): Promise<boolean> {
  const data = await ensureLoaded()
  return TABLE_NAMES.every((name) => (data[name]?.length ?? 0) === 0)
}
