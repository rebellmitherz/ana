import { FileText, Languages, PenLine } from 'lucide-react'
import Link from 'next/link'

import { pageContext } from '@/modules/app/context'
import { listDocuments } from '@/modules/documents/service'
import { listMessages } from '@/modules/messages/service'
import type { MessageKey } from '@/core/i18n'
import { formatDate } from '@/core/i18n'
import { Screen, ScreenHeader, Section } from '@/ui/layout'
import { CardLink, Chip, SectionTitle } from '@/ui/primitives'

export const dynamic = 'force-dynamic'

interface Entry {
  href: string
  titleKey: MessageKey
  subKey: MessageKey
  icon: React.ReactNode
}

const ENTRIES: Entry[] = [
  {
    href: '/germany/document',
    titleKey: 'germany.document.title',
    subKey: 'germany.document.sub',
    icon: <FileText className="size-5" strokeWidth={1.5} />,
  },
  {
    href: '/germany/write',
    titleKey: 'germany.write.title',
    subKey: 'germany.write.sub',
    icon: <PenLine className="size-5" strokeWidth={1.5} />,
  },
  {
    href: '/germany/translate',
    titleKey: 'germany.translate.title',
    subKey: 'germany.translate.sub',
    icon: <Languages className="size-5" strokeWidth={1.5} />,
  },
]

export default async function GermanyPage() {
  const { session, t } = await pageContext()
  const [documents, messages] = await Promise.all([
    listDocuments(session, 4),
    listMessages(session, 3),
  ])

  return (
    <Screen>
      <ScreenHeader
        title={t('germany.title')}
        subtitle={t('germany.subtitle')}
        backHref="/"
        backLabel={t('action.back')}
      />

      <Section>
        <div className="space-y-3">
          {ENTRIES.map((entry) => (
            <CardLink key={entry.href} href={entry.href} className="flex items-center gap-4 p-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-alubali-soft text-alubali">
                {entry.icon}
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[1.1rem] text-ink">{t(entry.titleKey)}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{t(entry.subKey)}</span>
              </span>
            </CardLink>
          ))}
        </div>
      </Section>

      {documents.length > 0 ? (
        <Section>
          <SectionTitle>{t('doc.upload.title')}</SectionTitle>
          <div className="space-y-2">
            {documents.map((document) => (
              <CardLink
                key={document.id}
                href={`/germany/document/${document.id}`}
                className="flex items-center justify-between gap-3 p-4"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[0.95rem] text-ink">
                    {document.analysis?.sender ?? document.file_name}
                  </span>
                  <span className="mt-0.5 block text-xs text-ink-faint">
                    {formatDate(document.created_at)}
                  </span>
                </span>
                {document.analysis?.deadline ? (
                  <Chip tone="caution">{formatDate(document.analysis.deadline.date)}</Chip>
                ) : null}
              </CardLink>
            ))}
          </div>
        </Section>
      ) : null}

      {messages.length > 0 ? (
        <Section>
          <SectionTitle>{t('write.title')}</SectionTitle>
          <div className="space-y-2">
            {messages.map((message) => (
              <Link
                key={message.id}
                href={`/germany/write?message=${message.id}`}
                className="block rounded-card border border-line bg-paper-raised p-4 transition-colors hover:border-line-strong"
              >
                <p className="text-georgian line-clamp-2 text-sm text-ink-soft">{message.brief_ka}</p>
                <p className="mt-1.5 text-xs text-ink-faint">{formatDate(message.created_at)}</p>
              </Link>
            ))}
          </div>
        </Section>
      ) : null}
    </Screen>
  )
}
