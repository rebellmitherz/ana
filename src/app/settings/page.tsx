import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { env } from '@/core/config/env'
import { COOKIE_LOCALE, COOKIE_NAME } from '@/core/auth/session'
import { LOCALES, type Locale } from '@/core/i18n'
import { actionContext, pageContext } from '@/modules/app/context'
import { hasDemoData, removeDemoData } from '@/modules/demo/seed'
import { getScopedStore } from '@/core/db'
import { Screen, ScreenHeader, Section } from '@/ui/layout'
import { Button, Card, SectionTitle } from '@/ui/primitives'

export const dynamic = 'force-dynamic'

async function setLocale(locale: Locale): Promise<void> {
  'use server'
  const store = await cookies()
  store.set(COOKIE_LOCALE, locale, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax', path: '/' })
  revalidatePath('/', 'layout')
}

async function setName(formData: FormData): Promise<void> {
  'use server'
  const name = String(formData.get('name') ?? '').trim().slice(0, 40)
  const store = await cookies()
  store.set(COOKIE_NAME, encodeURIComponent(name), {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    path: '/',
  })
  revalidatePath('/', 'layout')
}

async function removeDemo(): Promise<void> {
  'use server'
  const { session } = await actionContext()
  await removeDemoData(session)
  revalidatePath('/', 'layout')
  redirect('/')
}

export default async function SettingsPage() {
  const { session, t, locale } = await pageContext()
  const demoPresent = await hasDemoData(session)

  // Kostentransparenz: sie soll nie überrascht werden, was die App verbraucht.
  const store = await getScopedStore(session.orgId)
  const interactions = await store.list('ai_interactions', { limit: 500 })
  const month = new Date().toISOString().slice(0, 7)
  const monthCost = interactions
    .filter((row) => row.created_at.startsWith(month))
    .reduce((sum, row) => sum + (row.cost_usd ?? 0), 0)

  return (
    <Screen>
      <ScreenHeader title={t('settings.title')} backHref="/" backLabel={t('action.back')} />

      <Section>
        <SectionTitle>{t('onboarding.name.question')}</SectionTitle>
        <form action={setName} className="flex gap-2">
          <input
            name="name"
            defaultValue={session.displayName}
            placeholder={t('onboarding.name.placeholder')}
            className="flex-1 rounded-control border border-line bg-paper-raised px-4 py-3 text-[1rem] focus:border-gold focus:outline-none"
          />
          <Button type="submit" tone="secondary">
            {t('action.save')}
          </Button>
        </form>
      </Section>

      <Section>
        <SectionTitle>{t('settings.language')}</SectionTitle>
        <div className="flex gap-2">
          {LOCALES.map((code) => (
            <form key={code} action={setLocale.bind(null, code)} className="flex-1">
              <Button tone={code === locale ? 'primary' : 'secondary'} full type="submit">
                {t(code === 'ka' ? 'settings.language.ka' : 'settings.language.de')}
              </Button>
            </form>
          ))}
        </div>
      </Section>

      {demoPresent ? (
        <Section>
          <SectionTitle>{t('demo.badge')}</SectionTitle>
          <Card className="p-4">
            <p className="text-sm text-ink-muted">{t('demo.banner')}</p>
            <form action={removeDemo} className="mt-4">
              <Button tone="critical" full type="submit">
                {t('demo.remove')}
              </Button>
            </form>
          </Card>
        </Section>
      ) : null}

      <Section>
        <SectionTitle>{t('settings.about')}</SectionTitle>
        <Card className="divide-y divide-line px-4">
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-ink-muted">AI</span>
            <span className="text-sm text-ink">{env.ai.provider}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-ink-muted">Speech</span>
            <span className="text-sm text-ink">{env.speech.provider}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-ink-muted">Datenspeicher</span>
            <span className="text-sm text-ink">{session.isDemo ? 'lokal' : 'Supabase'}</span>
          </div>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-ink-muted">Kosten diesen Monat</span>
            <span className="text-sm text-ink">${monthCost.toFixed(3)}</span>
          </div>
        </Card>
      </Section>
    </Screen>
  )
}
