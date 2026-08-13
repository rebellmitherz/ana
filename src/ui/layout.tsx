import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from './cn'

/**
 * Seitengerüst. Mobile First mit einer maximalen Breite, damit die App auf
 * dem Desktop nicht auseinanderfällt — sie bleibt ein Telefon-Objekt.
 */
export function Screen({
  children,
  className,
  tone = 'default',
}: {
  children: ReactNode
  className?: string
  /** `warm` färbt den persönlichen Bereich spürbar anders ein. */
  tone?: 'default' | 'warm'
}) {
  return (
    <div className={cn('relative min-h-dvh', tone === 'warm' ? 'bg-paper-warm' : 'bg-paper', className)}>
      {/* Der persönliche Bereich soll sich anfühlen, als hätte man eine andere
          App geöffnet — ein warmer Lichtschein oben statt einer zweiten Marke. */}
      {tone === 'warm' ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-rose/45 via-rose-soft/35 to-transparent"
        />
      ) : null}
      <div className="relative mx-auto w-full max-w-[560px] px-5 pb-24 pt-safe">{children}</div>
    </div>
  )
}

export function ScreenHeader({
  title,
  subtitle,
  backHref,
  backLabel,
  action,
  className,
}: {
  title: string
  subtitle?: string
  backHref?: string
  backLabel?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('pb-6 pt-4', className)}>
      {backHref ? (
        <Link
          href={backHref}
          className="mb-5 -ml-2 inline-flex items-center gap-1 rounded-full py-1 pl-1 pr-3 text-sm text-ink-muted transition-colors hover:bg-paper-sunken hover:text-ink"
        >
          <ChevronLeft className="size-4" />
          {backLabel ?? ''}
        </Link>
      ) : null}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[1.75rem] leading-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-1.5 text-[0.95rem] text-ink-muted">{subtitle}</p> : null}
        </div>
        {action ? <div className="shrink-0 pt-1">{action}</div> : null}
      </div>
    </header>
  )
}

export function Section({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={cn('mb-8', className)}>{children}</section>
}

/** Liste mit feinen Trennlinien statt Karten-Stapel — ruhiger auf kleinen Displays. */
export function DividedList({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn('divide-y divide-line', className)}>{children}</div>
}
