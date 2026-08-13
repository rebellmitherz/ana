import { NextResponse } from 'next/server'

import { getSession } from '@/core/auth/session'
import { translateText } from '@/modules/messages/service'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * Der Beweis im Onboarding: Sie sagt einen Satz auf Georgisch und sieht ihn
 * sofort auf Deutsch. Ein eigener Endpunkt, weil hier nichts gespeichert wird —
 * es entsteht kein Datensatz, nur ein Moment.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const form = await request.formData().catch(() => null)
  const text = String(form?.get('text') ?? '').trim()
  if (text.length < 2) return NextResponse.json({ error: 'empty' }, { status: 400 })

  try {
    const result = await translateText(session, {
      text,
      direction: 'ka-de',
      register: 'private',
    })
    return NextResponse.json({ translation: result.translation })
  } catch {
    return NextResponse.json({ translation: null })
  }
}
