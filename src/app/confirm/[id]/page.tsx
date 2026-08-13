import { notFound } from 'next/navigation'

import { getScopedStore } from '@/core/db'
import { pageContext } from '@/modules/app/context'
import { getDraft } from '@/modules/assistant/service'
import { confirmDraftAction, discardDraftAction } from '@/modules/assistant/actions'
import { describeDraft, SKILL_OPTIONS, TASK_OPTIONS } from '@/modules/assistant/describe'
import { ConfirmationCard } from '@/ui/patterns/confirmation-card'
import { Screen, ScreenHeader } from '@/ui/layout'
import { ErrorState } from '@/ui/feedback'
import { ButtonLink } from '@/ui/primitives'

export const dynamic = 'force-dynamic'

export default async function ConfirmPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, t } = await pageContext()

  const draft = await getDraft(session, id)
  if (!draft) notFound()

  if (draft.state !== 'pending') {
    return (
      <Screen>
        <ScreenHeader title={t('confirm.saved')} backHref="/" backLabel={t('action.back')} />
        <ErrorState
          title={t('error.notFound')}
          hint={t('error.notFound.hint')}
          action={<ButtonLink href="/">{t('action.back')}</ButtonLink>}
        />
      </Screen>
    )
  }

  const store = await getScopedStore(session.orgId)
  const recording = draft.recording_id
    ? await store.get('voice_recordings', draft.recording_id)
    : null

  const description = describeDraft(
    draft.tool_name,
    draft.payload,
    draft.uncertain_fields,
    draft.missing_fields,
  )

  return (
    <Screen>
      <ScreenHeader title={t('confirm.tapToEdit')} backHref="/" backLabel={t('action.back')} />
      <ConfirmationCard
        draftId={draft.id}
        titleKey={description.titleKey}
        fields={description.fields}
        payload={draft.payload}
        transcript={recording?.transcript ?? null}
        skillOptions={SKILL_OPTIONS}
        taskOptions={TASK_OPTIONS}
        onConfirm={confirmDraftAction}
        onDiscard={discardDraftAction}
      />
    </Screen>
  )
}
