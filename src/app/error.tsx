'use client'

import { useEffect } from 'react'

import { useT } from '@/core/i18n/client'
import { Button } from '@/ui/primitives'

/**
 * Fehlerzustand.
 *
 * Kein Stacktrace, kein „500", keine englische Meldung. Ein ruhiger Satz auf
 * Georgisch und ein Weg vorwärts — und die Zusicherung, dass nichts verloren ist.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const t = useT()

  useEffect(() => {
    console.error('[app] Unbehandelter Fehler:', error)
  }, [error])

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col items-center justify-center px-7 text-center">
      <p className="font-display text-[1.6rem] text-ink">{t('error.generic')}</p>
      <p className="mt-2 text-[0.95rem] text-ink-muted">{t('error.generic.hint')}</p>
      <Button className="mt-8" onClick={reset}>
        {t('action.retry')}
      </Button>
    </div>
  )
}
