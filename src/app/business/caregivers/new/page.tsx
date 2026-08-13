import { pageContext } from '@/modules/app/context'
import { captureCaregiverFromTextAction } from '@/modules/assistant/actions'
import { Screen, ScreenHeader } from '@/ui/layout'
import { CaptureForm } from './capture-form'

export const dynamic = 'force-dynamic'

const EXAMPLE =
  'ნინო არის 47 წლის, აქვს რვა წლის გამოცდილება, ლაპარაკობს A2 დონეზე გერმანულად, იცნობს დემენციას და შეუძლია 1 სექტემბრიდან დაიწყოს.'

export default async function NewCaregiverPage() {
  const { t } = await pageContext()

  return (
    <Screen>
      <ScreenHeader
        title={t('caregivers.add')}
        subtitle={t('caregivers.empty.hint')}
        backHref="/business?tab=caregivers"
        backLabel={t('business.tab.caregivers')}
      />
      <CaptureForm
        action={captureCaregiverFromTextAction}
        placeholder={EXAMPLE}
        submitLabel={t('action.continue')}
      />
    </Screen>
  )
}
