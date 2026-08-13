import { Check, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

import { formatDate, type MessageKey } from '@/core/i18n'
import { actionContext, pageContext } from '@/modules/app/context'
import { completeTask } from '@/modules/tasks/service'
import { getTodayItems, groupByBucket, type TodayBucket } from '@/modules/today/service'
import { Screen, ScreenHeader, Section } from '@/ui/layout'
import { Card } from '@/ui/primitives'
import { EmptyState } from '@/ui/feedback'
import { VoiceCapture } from '@/ui/voice/voice-capture'

export const dynamic = 'force-dynamic'

async function markDone(taskId: string): Promise<void> {
  'use server'
  const { session } = await actionContext()
  await completeTask(session, taskId)
  revalidatePath('/today')
  revalidatePath('/')
}

const BUCKET_LABEL: Record<TodayBucket, MessageKey> = {
  overdue: 'today.section.overdue',
  today: 'today.section.today',
  soon: 'today.section.soon',
  attention: 'today.section.attention',
}

export default async function TodayPage() {
  const { session, t } = await pageContext()
  const items = await getTodayItems(session)
  const groups = groupByBucket(items)

  return (
    <Screen>
      <ScreenHeader
        title={t('today.title')}
        subtitle={t('home.tile.today.sub')}
        backHref="/"
        backLabel={t('action.back')}
      />

      {groups.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="size-7" strokeWidth={1.4} />}
          title={t('today.empty')}
          hint={t('today.empty.hint')}
        />
      ) : (
        groups.map(([bucket, entries]) => (
          <Section key={bucket}>
            <p
              className={`mb-2.5 text-sm ${
                bucket === 'overdue' ? 'text-critical' : 'text-ink-muted'
              }`}
            >
              {t(BUCKET_LABEL[bucket])}
            </p>
            <div className="space-y-2">
              {entries.map((item) => {
                const body = (
                  <>
                    <span className="text-georgian block text-[0.98rem] leading-snug text-ink">
                      {item.text ?? t(item.labelKey, item.params)}
                    </span>
                    {item.date ? (
                      <span className="mt-1 block text-xs text-ink-faint">
                        {formatDate(item.date)}
                      </span>
                    ) : null}
                  </>
                )

                return (
                  <Card key={item.id} className="flex items-start gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      {item.href ? (
                        <Link href={item.href} className="block">
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </div>

                    {item.taskId ? (
                      <form action={markDone.bind(null, item.taskId)}>
                        <button
                          type="submit"
                          aria-label={t('today.markDone')}
                          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line text-ink-faint transition-colors hover:border-positive hover:bg-positive-soft hover:text-positive"
                        >
                          <Check className="size-4" />
                        </button>
                      </form>
                    ) : null}
                  </Card>
                )
              })}
            </div>
          </Section>
        ))
      )}

      <VoiceCapture context="note" variant="fab" />
    </Screen>
  )
}
