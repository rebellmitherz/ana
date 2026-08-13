import 'server-only'

import { env } from '@/core/config/env'
import { localStore } from './local-store'
import { createSupabaseStore } from './supabase-store'
import { scopeStore, type ScopedStore, type Store } from './store'

export * from './types'
export {
  NotFoundError,
  scopeStore,
  type Insert,
  type Patch,
  type Query,
  type ScopedStore,
  type Store,
  type WhereClause,
} from './store'

/**
 * Liefert den passenden Treiber.
 *
 * Mit Supabase-Keys: PostgreSQL mit RLS.
 * Ohne: lokaler Dateispeicher, damit die App ohne Konfiguration vollständig
 * benutzbar ist. Der Aufrufer merkt keinen Unterschied.
 */
export async function getStore(): Promise<Store> {
  return env.supabase.configured ? createSupabaseStore() : localStore
}

/** Store, der automatisch auf die Organisation der Sitzung eingeschränkt ist. */
export async function getScopedStore(orgId: string): Promise<ScopedStore> {
  return scopeStore(await getStore(), orgId)
}
