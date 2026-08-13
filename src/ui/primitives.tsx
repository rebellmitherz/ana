import Link from 'next/link'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from './cn'

/* ==========================================================================
   Basisbausteine.
   Kein shadcn-Standardlook, keine Bootstrap-Anmutung: großzügige Radien,
   warme Flächen, Gold nur als Haarlinie.
   ========================================================================== */

type ButtonTone = 'primary' | 'secondary' | 'ghost' | 'quiet' | 'critical'
type ButtonSize = 'sm' | 'md' | 'lg'

const TONE: Record<ButtonTone, string> = {
  primary:
    'bg-alubali text-paper-raised shadow-soft hover:bg-alubali-deep active:scale-[0.985] disabled:bg-ink-faint',
  secondary:
    'bg-paper-raised text-ink border border-line hover:border-line-strong hover:bg-paper active:scale-[0.985]',
  ghost: 'text-ink-soft hover:bg-paper-sunken active:scale-[0.985]',
  quiet: 'text-ink-muted hover:text-ink',
  critical: 'bg-critical-soft text-critical hover:bg-critical hover:text-paper-raised',
}

const SIZE: Record<ButtonSize, string> = {
  sm: 'h-10 px-4 text-sm rounded-control gap-1.5',
  md: 'h-12 px-5 text-[0.95rem] rounded-control gap-2',
  lg: 'h-14 px-6 text-base rounded-control gap-2.5',
}

const BUTTON_BASE =
  'inline-flex items-center justify-center font-medium transition-all duration-200 ' +
  'disabled:cursor-not-allowed disabled:opacity-60 select-none'

interface ButtonOwnProps {
  tone?: ButtonTone
  size?: ButtonSize
  full?: boolean
  children: ReactNode
}

export function Button({
  tone = 'primary',
  size = 'md',
  full,
  className,
  children,
  ...props
}: ButtonOwnProps & ComponentProps<'button'>) {
  return (
    <button
      className={cn(BUTTON_BASE, TONE[tone], SIZE[size], full && 'w-full', className)}
      {...props}
    >
      {children}
    </button>
  )
}

export function ButtonLink({
  tone = 'primary',
  size = 'md',
  full,
  className,
  children,
  ...props
}: ButtonOwnProps & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(BUTTON_BASE, TONE[tone], SIZE[size], full && 'w-full', className)}
      {...props}
    >
      {children}
    </Link>
  )
}

export function IconButton({
  className,
  label,
  children,
  ...props
}: { label: string; children: ReactNode } & ComponentProps<'button'>) {
  return (
    <button
      aria-label={label}
      className={cn(
        'inline-flex size-11 items-center justify-center rounded-full text-ink-soft',
        'transition-colors duration-200 hover:bg-paper-sunken active:scale-95',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

/* -------------------------------------------------------------------------- */

export function Card({
  className,
  children,
  as: Tag = 'div',
  ...props
}: { children: ReactNode; as?: 'div' | 'section' | 'article' } & ComponentProps<'div'>) {
  return (
    <Tag
      className={cn(
        'rounded-card border border-line bg-paper-raised shadow-soft',
        className,
      )}
      {...props}
    >
      {children}
    </Tag>
  )
}

export function CardLink({
  className,
  children,
  ...props
}: { children: ReactNode } & ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        'block rounded-card border border-line bg-paper-raised shadow-soft',
        'transition-all duration-250 hover:border-line-strong hover:shadow-raised active:scale-[0.99]',
        className,
      )}
      {...props}
    >
      {children}
    </Link>
  )
}

/* -------------------------------------------------------------------------- */

type ChipTone = 'neutral' | 'accent' | 'gold' | 'positive' | 'caution' | 'critical'

const CHIP_TONE: Record<ChipTone, string> = {
  neutral: 'bg-paper-sunken text-ink-soft',
  accent: 'bg-alubali-soft text-alubali',
  gold: 'bg-gold-soft text-gold-deep',
  positive: 'bg-positive-soft text-positive',
  caution: 'bg-caution-soft text-caution',
  critical: 'bg-critical-soft text-critical',
}

export function Chip({
  tone = 'neutral',
  className,
  children,
  ...props
}: { tone?: ChipTone; children: ReactNode } & ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8rem] font-medium',
        CHIP_TONE[tone],
        className,
      )}
      {...props}
    >
      {children}
    </span>
  )
}

/* -------------------------------------------------------------------------- */

export function GoldRule({ className }: { className?: string }) {
  return <div className={cn('rule-gold my-6 opacity-50', className)} aria-hidden />
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn('animate-pulse rounded-control bg-paper-sunken', className)}
      aria-hidden
    />
  )
}

/** Beschriftete Wertzeile — das Arbeitspferd aller Detailansichten. */
export function ValueRow({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: 'default' | 'uncertain' | 'missing'
  onClick?: () => void
}) {
  const interactive = Boolean(onClick)
  const Element = interactive ? 'button' : 'div'

  return (
    <Element
      {...(interactive ? { type: 'button' as const, onClick } : {})}
      className={cn(
        'flex w-full items-baseline justify-between gap-4 py-3 text-left',
        interactive && 'transition-colors duration-200 hover:bg-paper-sunken/60 rounded-lg -mx-2 px-2',
      )}
    >
      <span className="shrink-0 text-sm text-ink-muted">{label}</span>
      <span className="flex min-w-0 flex-col items-end gap-0.5">
        <span
          className={cn(
            'text-right text-[0.95rem] font-medium text-ink',
            tone === 'uncertain' && 'text-gold-deep',
            tone === 'missing' && 'font-normal text-ink-faint',
          )}
        >
          {value}
        </span>
        {hint ? <span className="text-xs text-ink-faint">{hint}</span> : null}
      </span>
    </Element>
  )
}

/** Abschnittsüberschrift innerhalb einer Seite. */
export function SectionTitle({
  children,
  action,
}: {
  children: ReactNode
  action?: ReactNode
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <h2 className="text-lg text-ink">{children}</h2>
      {action}
    </div>
  )
}
