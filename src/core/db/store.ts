import type { Id, Row, TableName } from './types'

/**
 * Der Port zur Datenhaltung.
 *
 * Zwei Implementierungen:
 *   * `local-store`    — JSON-Datei unter .data/, Demo-Modus ohne jede Konfiguration
 *   * `supabase-store` — PostgreSQL mit RLS, sobald Keys vorhanden sind
 *
 * Bewusst schmal gehalten: V1 arbeitet mit Dutzenden, nicht Millionen von
 * Zeilen. Matching und Filterung laufen in TypeScript über geladene Listen.
 * Sobald das nicht mehr trägt, wandern diese Abfragen in SQL-Funktionen —
 * die Repository-Schicht ist die einzige Stelle, die das dann merkt.
 */

export type WhereValue = string | number | boolean | null | undefined
export type WhereClause<T> = Partial<{ [K in keyof T]: WhereValue | WhereValue[] }>

export interface Query<T> {
  where?: WhereClause<T>
  orderBy?: { column: keyof T & string; ascending?: boolean }
  limit?: number
  /** Standard ist false — weich gelöschte Zeilen bleiben unsichtbar. */
  includeDeleted?: boolean
}

/** Felder, die der Store selbst setzt — sie dürfen beim Einfügen fehlen. */
type GeneratedField = 'id' | 'created_at' | 'updated_at' | 'deleted_at' | 'org_id' | 'is_demo'

export type Insert<T extends TableName> = Omit<Row<T>, GeneratedField> &
  Partial<Pick<Row<T>, Extract<GeneratedField, keyof Row<T>>>>

export type Patch<T extends TableName> = Partial<Omit<Row<T>, 'id' | 'org_id' | 'created_at'>>

export interface Store {
  list<T extends TableName>(table: T, query?: Query<Row<T>>): Promise<Row<T>[]>
  get<T extends TableName>(table: T, id: Id): Promise<Row<T> | null>
  insert<T extends TableName>(table: T, values: Insert<T>): Promise<Row<T>>
  update<T extends TableName>(table: T, id: Id, patch: Patch<T>): Promise<Row<T>>
  softDelete<T extends TableName>(table: T, id: Id): Promise<void>
  hardDelete<T extends TableName>(table: T, id: Id): Promise<void>
  deleteWhere<T extends TableName>(table: T, where: WhereClause<Row<T>>): Promise<number>
}

/**
 * Mandantengebundene Sicht auf den Store.
 *
 * Jede Abfrage wird automatisch auf die Organisation eingeschränkt und jeder
 * Schreibvorgang mit ihr versehen. Bei Supabase ist das doppelt gesichert (RLS),
 * im lokalen Treiber ist es die einzige Grenze — deshalb ist sie hier hart.
 */
export interface ScopedStore {
  readonly orgId: Id
  list<T extends TableName>(table: T, query?: Query<Row<T>>): Promise<Row<T>[]>
  get<T extends TableName>(table: T, id: Id): Promise<Row<T> | null>
  insert<T extends TableName>(table: T, values: Insert<T>): Promise<Row<T>>
  update<T extends TableName>(table: T, id: Id, patch: Patch<T>): Promise<Row<T>>
  softDelete<T extends TableName>(table: T, id: Id): Promise<void>
  hardDelete<T extends TableName>(table: T, id: Id): Promise<void>
  deleteWhere<T extends TableName>(table: T, where: WhereClause<Row<T>>): Promise<number>
}

export function scopeStore(store: Store, orgId: Id): ScopedStore {
  const withOrg = <T extends TableName>(query?: Query<Row<T>>): Query<Row<T>> => ({
    ...query,
    where: { ...(query?.where ?? {}), org_id: orgId } as WhereClause<Row<T>>,
  })

  const assertOwned = async <T extends TableName>(table: T, id: Id): Promise<Row<T>> => {
    const row = await store.get(table, id)
    if (!row || row.org_id !== orgId) {
      throw new NotFoundError(table, id)
    }
    return row
  }

  return {
    orgId,
    list: (table, query) => store.list(table, withOrg(query)),
    async get(table, id) {
      const row = await store.get(table, id)
      return row && row.org_id === orgId ? row : null
    },
    insert: (table, values) => store.insert(table, { ...values, org_id: orgId }),
    async update(table, id, patch) {
      await assertOwned(table, id)
      return store.update(table, id, patch)
    },
    async softDelete(table, id) {
      await assertOwned(table, id)
      return store.softDelete(table, id)
    },
    async hardDelete(table, id) {
      await assertOwned(table, id)
      return store.hardDelete(table, id)
    },
    deleteWhere: (table, where) => store.deleteWhere(table, { ...where, org_id: orgId }),
  }
}

export class NotFoundError extends Error {
  constructor(
    readonly table: string,
    readonly id: string,
  ) {
    super(`${table}/${id} nicht gefunden`)
    this.name = 'NotFoundError'
  }
}

/** Prüft eine Zeile gegen eine Where-Klausel (gemeinsam für alle Treiber). */
export function matchesWhere<T extends object>(row: T, where?: WhereClause<T>): boolean {
  if (!where) return true
  for (const [key, expected] of Object.entries(where)) {
    if (expected === undefined) continue
    const actual = (row as Record<string, unknown>)[key]
    if (Array.isArray(expected)) {
      if (!expected.includes(actual as WhereValue)) return false
    } else if (actual !== expected) {
      return false
    }
  }
  return true
}
