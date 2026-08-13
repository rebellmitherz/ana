import type { ReactNode } from 'react'

import { cn } from './cn'
import { Skeleton } from './primitives'

/**
 * Leer-, Fehler- und Ladezustände.
 *
 * Regel: Kein Zustand ist eine Sackgasse und keiner sagt „Keine Daten".
 * Jeder Leerzustand erklärt, was als Nächstes möglich ist.
 */

export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode
  title: string
  hint?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-14 text-center', className)}>
      {icon ? (
        <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-paper-sunken text-ink-faint">
          {icon}
        </div>
      ) : null}
      <p className="font-display text-lg text-ink">{title}</p>
      {hint ? <p className="mt-2 max-w-[36ch] text-[0.95rem] text-ink-muted">{hint}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  title,
  hint,
  action,
}: {
  title: string
  hint?: string
  action?: ReactNode
}) {
  return (
    <div className="rounded-card border border-critical/15 bg-critical-soft/60 p-6 text-center">
      <p className="font-display text-base text-critical">{title}</p>
      {hint ? <p className="mt-2 text-sm text-ink-soft">{hint}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="rounded-card border border-line bg-paper-raised p-4">
          <div className="flex items-center gap-4">
            <Skeleton className="size-12 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * Mehrstufiger Ladezustand für AI-Aufgaben.
 *
 * Ein Spinner mit „Lädt…" lässt 8 Sekunden wie 30 wirken. Benannte Schritte
 * machen dieselbe Wartezeit erträglich — und ehrlich.
 */
export function StepProgress({ steps, active }: { steps: string[]; active: number }) {
  return (
    <ol className="space-y-4">
      {steps.map((step, index) => {
        const done = index < active
        const current = index === active
        return (
          <li key={step} className="flex items-center gap-3">
            <span
              className={cn(
                'relative flex size-6 shrink-0 items-center justify-center rounded-full border transition-colors duration-300',
                done && 'border-alubali bg-alubali',
                current && 'border-alubali',
                !done && !current && 'border-line',
              )}
            >
              {done ? (
                <svg viewBox="0 0 12 12" className="size-3 text-paper-raised" aria-hidden>
                  <path
                    d="M2.5 6.2 4.8 8.5 9.5 3.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : current ? (
                <>
                  <span className="absolute inset-0 animate-pulse-slow rounded-full bg-alubali/30" />
                  <span className="size-2 rounded-full bg-alubali" />
                </>
              ) : null}
            </span>
            <span
              className={cn(
                'text-[0.95rem] transition-colors duration-300',
                current ? 'text-ink' : done ? 'text-ink-muted' : 'text-ink-faint',
              )}
            >
              {step}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
