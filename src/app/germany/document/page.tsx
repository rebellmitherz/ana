import { pageContext } from '@/modules/app/context'
import { Screen, ScreenHeader } from '@/ui/layout'
import { UploadForm } from './upload-form'

export const dynamic = 'force-dynamic'

export default async function DocumentUploadPage() {
  const { t } = await pageContext()

  return (
    <Screen>
      <ScreenHeader
        title={t('doc.upload.title')}
        subtitle={t('germany.document.sub')}
        backHref="/germany"
        backLabel={t('germany.title')}
      />
      <UploadForm />
    </Screen>
  )
}
