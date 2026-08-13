import { pageContext } from '@/modules/app/context'
import { getDocument } from '@/modules/documents/service'
import { getMessage } from '@/modules/messages/service'
import { Screen, ScreenHeader } from '@/ui/layout'
import { Card } from '@/ui/primitives'
import { WriteForm } from './write-form'

export const dynamic = 'force-dynamic'

export default async function WritePage({
  searchParams,
}: {
  searchParams: Promise<{ document?: string; message?: string }>
}) {
  const { document: documentId, message: messageId } = await searchParams
  const { session, t } = await pageContext()

  const [document, existing] = await Promise.all([
    documentId ? getDocument(session, documentId) : Promise.resolve(null),
    messageId ? getMessage(session, messageId) : Promise.resolve(null),
  ])

  return (
    <Screen>
      <ScreenHeader
        title={document ? t('doc.reply.title') : t('write.title')}
        subtitle={document ? t('doc.reply.hint') : t('germany.write.sub')}
        backHref={document ? `/germany/document/${document.id}` : '/germany'}
        backLabel={t('action.back')}
      />

      {document?.analysis ? (
        <Card className="mb-6 border-l-[3px] border-l-gold p-4">
          <p className="text-xs text-ink-faint">{document.analysis.sender}</p>
          <p className="text-georgian mt-1 text-[0.95rem] text-ink-soft">
            {document.analysis.subject_ka}
          </p>
        </Card>
      ) : null}

      <WriteForm
        documentId={document?.id}
        initialMessage={existing}
        initialBrief={existing?.brief_ka}
      />
    </Screen>
  )
}
