'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

import { actionContext } from '@/modules/app/context'
import { createTask } from '@/modules/tasks/service'
import { explainDocument, getDocument, UploadError } from './service'

export type UploadState = { error: 'too_large' | 'wrong_type' | 'failed' | null }

export async function explainDocumentAction(
  _previous: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const { session } = await actionContext()
  const file = formData.get('file')

  if (!(file instanceof File) || file.size === 0) {
    return { error: 'wrong_type' }
  }

  let documentId: string
  try {
    const document = await explainDocument(session, file)
    documentId = document.id
  } catch (error) {
    if (error instanceof UploadError) return { error: error.reason }
    console.error('[documents] Analyse gescheitert:', error)
    return { error: 'failed' }
  }

  revalidatePath('/germany')
  redirect(`/germany/document/${documentId}`)
}

/** Frist aus einem Brief in eine Aufgabe überführen. Rein rechnerisch, kein AI. */
export async function createDeadlineReminderAction(documentId: string): Promise<void> {
  const { session } = await actionContext()
  const document = await getDocument(session, documentId)
  if (!document?.analysis?.deadline) return

  // Drei Tage vor Fristende erinnern — nicht am Tag selbst.
  const deadline = new Date(`${document.analysis.deadline.date}T00:00:00`)
  deadline.setDate(deadline.getDate() - 3)

  await createTask(session, {
    title: document.analysis.deadline.what_ka,
    detail: document.analysis.sender,
    dueAt: deadline.toISOString().slice(0, 10),
    source: 'assistant',
  })

  revalidatePath('/today')
  redirect('/today')
}
