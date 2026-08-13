import Link from 'next/link'

import { getLocale } from '@/core/auth/session'
import { getTranslator } from '@/core/i18n'

export default async function NotFound() {
  const t = getTranslator(await getLocale())

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col items-center justify-center px-7 text-center">
      <p className="font-display text-[1.6rem] text-ink">{t('error.notFound')}</p>
      <p className="mt-2 text-[0.95rem] text-ink-muted">{t('error.notFound.hint')}</p>
      <Link
        href="/"
        className="mt-8 inline-flex h-12 items-center justify-center rounded-control bg-alubali px-6 text-[0.95rem] font-medium text-paper-raised"
      >
        {t('action.back')}
      </Link>
    </div>
  )
}
