import { redirect } from 'next/navigation'

import { env } from '@/core/config/env'
import { getSession, getLocale } from '@/core/auth/session'
import { getTranslator } from '@/core/i18n'
import { SignInForm } from './sign-in-form'

export const dynamic = 'force-dynamic'

/**
 * Anmeldung — existiert nur, wenn Supabase konfiguriert ist.
 *
 * Ohne Supabase gibt es immer eine Sitzung, und diese Seite leitet direkt
 * weiter. Das hält den Demo-Modus frei von einer Hürde, die dort nichts schützt.
 */
export default async function AuthPage() {
  if (!env.supabase.configured) redirect('/')

  const session = await getSession()
  if (session) redirect('/')

  const locale = await getLocale()
  const t = getTranslator(locale)

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-7">
      <div className="text-center">
        <p className="font-display text-[2.4rem] leading-tight text-alubali">ალუბალი</p>
        <div className="rule-gold mx-auto my-6 w-20 opacity-60" />
        <p className="text-georgian text-[1rem] text-ink-muted">{t('app.tagline')}</p>
      </div>

      <div className="mt-12">
        <SignInForm
          labels={{
            email: t('family.field.email'),
            continue: t('action.continue'),
            sent: t('confirm.saved'),
            failed: t('error.generic'),
          }}
        />
      </div>
    </div>
  )
}
