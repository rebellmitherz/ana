'use client'

import { useEffect, useRef, useState } from 'react'

import { cn } from './cn'

/**
 * Wortmarke — und das erste Easter Egg.
 *
 * Langes Drücken (1,2 s) lässt eine Kirsche fallen und zeigt eine persönliche
 * Nachricht. Immer verfügbar, aber nur, wenn man danach sucht. Niemals im
 * Business-Bereich, niemals als Popup, niemals erklärt.
 *
 * Der Text steht hier bewusst als Konstante und nicht in den Übersetzungen:
 * Er ist keine Oberfläche, er ist eine Nachricht.
 */
const SECRET_MESSAGE = 'შენთვის. იმიტომ, რომ შენ ხარ.'

export function Wordmark({ className }: { className?: string }) {
  const [revealed, setRevealed] = useState(false)
  const timer = useRef<number | null>(null)

  const begin = () => {
    timer.current = window.setTimeout(() => setRevealed(true), 1200)
  }
  const end = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
  }

  useEffect(() => {
    if (!revealed) return
    const timeout = window.setTimeout(() => setRevealed(false), 6000)
    return () => window.clearTimeout(timeout)
  }, [revealed])

  useEffect(() => () => end(), [])

  return (
    <div className="relative inline-block">
      <span
        onPointerDown={begin}
        onPointerUp={end}
        onPointerLeave={end}
        onContextMenu={(event) => event.preventDefault()}
        className={cn(
          'select-none font-display text-[1.05rem] tracking-tight text-alubali',
          className,
        )}
      >
        ალუბალი
      </span>

      {revealed ? (
        <>
          <span
            className="pointer-events-none absolute -top-1 left-1/2 text-lg"
            style={{ animation: 'alubali-fall 2.2s cubic-bezier(0.4, 0, 0.6, 1) forwards' }}
            aria-hidden
          >
            🍒
          </span>
          <span className="absolute left-1/2 top-8 z-20 w-max max-w-[70vw] -translate-x-1/2 rounded-card border border-line bg-paper-raised px-4 py-2.5 text-sm text-ink-soft shadow-raised animate-in">
            {SECRET_MESSAGE}
          </span>
          <style>{`
            @keyframes alubali-fall {
              0%   { transform: translate(-50%, -14px) rotate(0deg); opacity: 0; }
              15%  { opacity: 1; }
              100% { transform: translate(-50%, 30px) rotate(22deg); opacity: 0; }
            }
          `}</style>
        </>
      ) : null}
    </div>
  )
}
