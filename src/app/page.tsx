import { Briefcase, CalendarCheck, Gem, Languages } from 'lucide-react'
import Link from 'next/link'
import { Settings } from 'lucide-react'

import { redirect } from 'next/navigation'

import { hasCompletedOnboarding } from '@/core/auth/session'
import { pageContext } from '@/modules/app/context'
import { getTodayItems } from '@/modules/today/service'
import type { MessageKey } from '@/core/i18n'
import { Wordmark } from '@/ui/brand'
import { VoiceCapture } from '@/ui/voice/voice-capture'
import { GoldRule } from '@/ui/primitives'

export const dynamic = 'force-dynamic'

function greetingKey(): MessageKey {
  const hour = new Date().getHours()
  if (hour < 5) return 'home.greeting.night'
  if (hour < 11) return 'home.greeting.morning'
  if (hour < 18) return 'home.greeting.day'
  return 'home.greeting.evening'
}

interface Tile {
  href: string
  titleKey: MessageKey
  subKey: MessageKey
  icon: React.ReactNode
  tone: 'ink' | 'accent' | 'gold' | 'rose'
  badge?: number
}

const TONE_STYLES: Record<Tile['tone'], string> = {
  ink: 'bg-paper-raised border-line',
  accent: 'bg-alubali-tint border-alubali/12',
  gold: 'bg-gold-soft/60 border-gold/20',
  rose: 'bg-rose-soft border-rose/40',
}

export default async function HomePage() {
  if (!(await hasCompletedOnboarding())) redirect('/onboarding')

  const { t, session } = await pageContext()
  const todayItems = await getTodayItems(session)
  const urgent = todayItems.filter((item) => item.bucket === 'overdue' || item.bucket === 'today')

  const tiles: Tile[] = [
    {
      href: '/business',
      titleKey: 'home.tile.business',
      subKey: 'home.tile.business.sub',
      icon: <Briefcase className="size-[22px]" strokeWidth={1.5} />,
      tone: 'ink',
    },
    {
      href: '/germany',
      titleKey: 'home.tile.germany',
      subKey: 'home.tile.germany.sub',
      icon: <Languages className="size-[22px]" strokeWidth={1.5} />,
      tone: 'accent',
    },
    {
      href: '/today',
      titleKey: 'home.tile.today',
      subKey: 'home.tile.today.sub',
      icon: <CalendarCheck className="size-[22px]" strokeWidth={1.5} />,
      tone: 'gold',
      badge: urgent.length,
    },
    {
      href: '/me',
      titleKey: 'home.tile.me',
      subKey: 'home.tile.me.sub',
      icon: <Gem className="size-[22px]" strokeWidth={1.5} />,
      tone: 'rose',
    },
  ]

  return (
    <div className="min-h-dvh bg-paper">
      <div className="mx-auto w-full max-w-[560px] px-5 pb-16 pt-safe">
        <header className="flex items-center justify-between pb-8 pt-5">
          <Wordmark />
          <Link
            href="/settings"
            aria-label={t('settings.title')}
            className="flex size-10 items-center justify-center rounded-full text-ink-faint transition-colors hover:bg-paper-sunken hover:text-ink-soft"
          >
            <Settings className="size-[18px]" strokeWidth={1.5} />
          </Link>
        </header>

        <div className="animate-in">
          <h1 className="text-[2rem] leading-tight text-ink">
            {t(greetingKey())}
            {session.displayName ? (
              <span className="text-alubali">, {session.displayName}</span>
            ) : null}
          </h1>
        </div>

        <GoldRule className="my-7" />

        <div className="grid grid-cols-2 gap-3 animate-rise">
          {tiles.map((tile) => (
            <Link
              key={tile.href}
              href={tile.href}
              className={`group relative flex min-h-[142px] flex-col justify-between rounded-card border p-4 shadow-soft transition-all duration-300 hover:shadow-raised active:scale-[0.98] ${TONE_STYLES[tile.tone]}`}
            >
              <span className="flex items-start justify-between">
                <span className="text-ink-soft">{tile.icon}</span>
                {tile.badge ? (
                  <span className="flex size-6 items-center justify-center rounded-full bg-alubali text-xs font-medium text-paper-raised">
                    {tile.badge}
                  </span>
                ) : null}
              </span>
              <span>
                <span className="block font-display text-[1.2rem] leading-snug text-ink">
                  {t(tile.titleKey)}
                </span>
                <span className="mt-0.5 block text-[0.82rem] leading-snug text-ink-muted">
                  {t(tile.subKey)}
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className="pt-14 pb-4">
          <VoiceCapture context="home" variant="hero" />
        </div>
      </div>
    </div>
  )
}
