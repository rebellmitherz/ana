import { pageContext } from '@/modules/app/context'
import { Screen, ScreenHeader } from '@/ui/layout'
import { TranslateForm } from './translate-form'

export const dynamic = 'force-dynamic'

export default async function TranslatePage() {
  const { t } = await pageContext()

  return (
    <Screen>
      <ScreenHeader
        title={t('translate.title')}
        subtitle={t('germany.translate.sub')}
        backHref="/germany"
        backLabel={t('germany.title')}
      />
      <TranslateForm />
    </Screen>
  )
}
