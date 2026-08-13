import { pageContext } from '@/modules/app/context'
import { OnboardingFlow } from './onboarding-flow'

export const dynamic = 'force-dynamic'

export default async function OnboardingPage() {
  // Erzwingt Sitzung und legt die Demo-Daten an, bevor der erste Screen erscheint.
  await pageContext()
  return (
    <div className="min-h-dvh bg-paper">
      <OnboardingFlow />
    </div>
  )
}
