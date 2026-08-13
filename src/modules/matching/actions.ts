'use server'

import { revalidatePath } from 'next/cache'

import { actionContext } from '@/modules/app/context'
import { proposeCandidate } from './service'

export async function proposeCandidateAction(
  caseId: string,
  caregiverId: string,
): Promise<{ ok: boolean }> {
  const { session } = await actionContext()

  try {
    await proposeCandidate(session, caseId, caregiverId)
  } catch (error) {
    console.error('[matching] Vorschlag gescheitert:', error)
    return { ok: false }
  }

  revalidatePath(`/business/cases/${caseId}`)
  revalidatePath('/business')
  revalidatePath('/today')
  return { ok: true }
}
