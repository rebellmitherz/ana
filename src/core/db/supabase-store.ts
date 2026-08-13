import 'server-only'

import { createServerClient } from '@supabase/ssr'
import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

import { env } from '@/core/config/env'
import type { Id, Row, TableName } from './types'
import { NotFoundError, type Insert, type Patch, type Query, type Store, type WhereClause } from './store'

/**
 * Supabase-Treiber.
 *
 * Verbindet mit dem JWT der Nutzerin, damit Row Level Security greift.
 * Der Service-Role-Key wird hier NIE verwendet — er ist ausschließlich für
 * Seed und Cron-Jobs vorgesehen und lebt in eigenen Modulen.
 */

export async function createSupabaseClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(env.supabase.url ?? '', env.supabase.anonKey ?? '', {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          for (const { name, value, options } of items) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // In Server Components ist Setzen nicht erlaubt — die Middleware
          // erneuert die Session, deshalb ist das hier gefahrlos.
        }
      },
    },
  })
}

function applyWhere<T>(
  builder: ReturnType<ReturnType<SupabaseClient['from']>['select']>,
  where?: WhereClause<T>,
) {
  let query = builder
  if (!where) return query
  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      query = query.in(key, value)
    } else if (value === null) {
      query = query.is(key, null)
    } else {
      query = query.eq(key, value)
    }
  }
  return query
}

export async function createSupabaseStore(): Promise<Store> {
  const client = await createSupabaseClient()

  return {
    async list<T extends TableName>(name: T, query?: Query<Row<T>>): Promise<Row<T>[]> {
      let builder = applyWhere(client.from(name).select('*'), query?.where)

      if (!query?.includeDeleted) {
        builder = builder.is('deleted_at', null)
      }
      if (query?.orderBy) {
        builder = builder.order(query.orderBy.column, {
          ascending: query.orderBy.ascending !== false,
        })
      }
      if (query?.limit) {
        builder = builder.limit(query.limit)
      }

      const { data, error } = await builder
      if (error) throw new Error(`[supabase] list ${name}: ${error.message}`)
      return (data ?? []) as unknown as Row<T>[]
    },

    async get<T extends TableName>(name: T, id: Id): Promise<Row<T> | null> {
      const { data, error } = await client.from(name).select('*').eq('id', id).maybeSingle()
      if (error) throw new Error(`[supabase] get ${name}: ${error.message}`)
      return (data ?? null) as unknown as Row<T> | null
    },

    async insert<T extends TableName>(name: T, values: Insert<T>): Promise<Row<T>> {
      const { data, error } = await client.from(name).insert(values).select('*').single()
      if (error) throw new Error(`[supabase] insert ${name}: ${error.message}`)
      return data as unknown as Row<T>
    },

    async update<T extends TableName>(name: T, id: Id, patch: Patch<T>): Promise<Row<T>> {
      const { data, error } = await client
        .from(name)
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (error) throw new Error(`[supabase] update ${name}: ${error.message}`)
      if (!data) throw new NotFoundError(name, id)
      return data as unknown as Row<T>
    },

    async softDelete<T extends TableName>(name: T, id: Id): Promise<void> {
      const { error } = await client
        .from(name)
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw new Error(`[supabase] softDelete ${name}: ${error.message}`)
    },

    async hardDelete<T extends TableName>(name: T, id: Id): Promise<void> {
      const { error } = await client.from(name).delete().eq('id', id)
      if (error) throw new Error(`[supabase] hardDelete ${name}: ${error.message}`)
    },

    async deleteWhere<T extends TableName>(name: T, where: WhereClause<Row<T>>): Promise<number> {
      let builder = client.from(name).delete({ count: 'exact' })
      for (const [key, value] of Object.entries(where)) {
        if (value === undefined) continue
        builder = Array.isArray(value) ? builder.in(key, value) : builder.eq(key, value)
      }
      const { error, count } = await builder
      if (error) throw new Error(`[supabase] deleteWhere ${name}: ${error.message}`)
      return count ?? 0
    },
  }
}
