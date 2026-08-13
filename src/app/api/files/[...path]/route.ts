import { NextResponse } from 'next/server'

import { getSession } from '@/core/auth/session'
import { readObject } from '@/core/storage'

export const runtime = 'nodejs'

/**
 * Dateiauslieferung im lokalen Betrieb.
 *
 * Es gibt keinen statischen Pfad zu hochgeladenen Dateien — jeder Abruf prüft
 * die Sitzung und die Zugehörigkeit zur Organisation. Mit Supabase übernimmt
 * das eine Signed URL mit 60 Sekunden Gültigkeit; dieser Endpunkt wird dann
 * gar nicht erst verwendet.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
): Promise<NextResponse> {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { path } = await params
  const objectPath = path.map(decodeURIComponent).join('/')

  // Der erste Pfadabschnitt ist die Organisation. Alles andere ist fremd.
  if (path[0] !== session.orgId) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const object = await readObject(objectPath)
  if (!object) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return new NextResponse(new Uint8Array(object.data), {
    headers: {
      'content-type': object.contentType,
      'cache-control': 'private, max-age=60',
      'content-disposition': 'inline',
    },
  })
}
