import { pageContext } from '@/modules/app/context'
import { captureFamilyFromTextAction } from '@/modules/assistant/actions'
import { Screen, ScreenHeader } from '@/ui/layout'
import { CaptureForm } from '../../caregivers/new/capture-form'

export const dynamic = 'force-dynamic'

const EXAMPLE =
  'ერთი ოჯახი დამირეკა მიუნხენიდან. დედა 82 წლისაა, დაწყებითი დემენცია აქვს, დამოუკიდებლად მოძრაობს და მარტო ცხოვრობს. სექტემბრიდან სჭირდებათ.'

export default async function NewCasePage() {
  const { t } = await pageContext()

  return (
    <Screen>
      <ScreenHeader
        title={t('families.add')}
        subtitle={t('families.empty.hint')}
        backHref="/business?tab=families"
        backLabel={t('business.tab.families')}
      />
      {/* Funktioniert auch mit einer weitergeleiteten deutschen E-Mail als Eingabe. */}
      <CaptureForm
        action={captureFamilyFromTextAction}
        placeholder={EXAMPLE}
        submitLabel={t('action.continue')}
      />
    </Screen>
  )
}
