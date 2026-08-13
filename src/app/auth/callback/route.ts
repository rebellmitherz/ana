import { NextResponse } from 'next/server'

import { env } from '@/core/config/env'
import { createSupabaseClient } from '@/core/db/supabase-store'

export const runtime = 'nodejs'

/** Tauscht den Magic-Link-Code gegen eine Sitzung. */
export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')

  if (!env.supabase.configured || !code) {
    return NextResponse.redirect(new URL('/auth', url.origin))
  }

  const client = await createSupabaseClient()
  const { error } = await client.auth.exchangeCodeForSession(code)

  return NextResponse.redirect(new URL(error ? '/auth' : '/', url.origin))
}
