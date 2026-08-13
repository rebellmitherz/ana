import { AlertTriangle, CalendarClock, ChevronRight, Info, PenLine } from 'lucide-react'
import { notFound } from 'next/navigation'

import { formatDate, formatMoney, type MessageKey } from '@/core/i18n'
import { pageContext } from '@/modules/app/context'
import { daysUntil, getDocument } from '@/modules/documents/service'
import { createDeadlineReminderAction } from '@/modules/documents/actions'
import { Screen, ScreenHeader, Section } from '@/ui/layout'
import { Button, ButtonLink, Card, Chip, GoldRule } from '@/ui/primitives'
import { EmptyState } from '@/ui/feedback'

export const dynamic = 'force-dynamic'

export default async function DocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { session, t } = await pageContext()

  const document = await getDocument(session, id)
  if (!document) notFound()

  const analysis = document.analysis

  if (!analysis) {
    return (
      <Screen>
        <ScreenHeader
          title={document.file_name}
          backHref="/germany/document"
          backLabel={t('germany.title')}
        />
        <EmptyState
          title={t('error.ai.failed')}
          hint={t('error.ai.failed.hint')}
          action={<ButtonLink href="/germany/document">{t('doc.action.newDocument')}</ButtonLink>}
        />
      </Screen>
    )
  }

  const remaining = daysUntil(analysis.deadline?.date)

  return (
    <Screen>
      <ScreenHeader
        title={analysis.subject_ka}
        backHref="/germany"
        backLabel={t('germany.title')}
      />

      {/* Wer schreibt ------------------------------------------------------ */}
      <Section>
        <div className="flex items-center gap-3">
          <Chip tone="neutral">{t(`doc.type.${analysis.document_type}` as MessageKey)}</Chip>
          {analysis.action_required ? (
            <Chip tone="accent">{t('doc.mustReact.yes')}</Chip>
          ) : (
            <Chip tone="positive">{t('doc.mustReact.no')}</Chip>
          )}
        </div>
        <p className="mt-4 text-sm text-ink-muted">{t('doc.section.sender')}</p>
        <p className="font-display text-[1.15rem] text-ink">{analysis.sender}</p>
      </Section>

      {/* Frist -------------------------------------------------------------- */}
      {analysis.deadline ? (
        <Section>
          <Card
            className={`border-l-[3px] p-5 ${
              remaining !== null && remaining < 0
                ? 'border-l-critical'
                : remaining !== null && remaining <= 7
                  ? 'border-l-caution'
                  : 'border-l-gold'
            }`}
          >
            <div className="flex items-start gap-3">
              <CalendarClock className="mt-0.5 size-5 shrink-0 text-caution" strokeWidth={1.5} />
              <div className="min-w-0">
                <p className="text-sm text-ink-muted">{t('doc.section.deadline')}</p>
                <p className="mt-0.5 font-display text-[1.15rem] text-ink">
                  {formatDate(analysis.deadline.date)}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {remaining === null
                    ? null
                    : remaining < 0
                      ? t('doc.deadline.passed')
                      : remaining === 0
                        ? t('doc.deadline.today')
                        : t('doc.deadline.in', { days: remaining })}
                </p>
                <p className="text-georgian mt-2.5 text-[0.95rem] text-ink-soft">
                  {analysis.deadline.what_ka}
                </p>
              </div>
            </div>
            <form action={createDeadlineReminderAction.bind(null, document.id)} className="mt-4">
              <Button tone="secondary" size="sm" full type="submit">
                {t('doc.action.reminder')}
              </Button>
            </form>
          </Card>
        </Section>
      ) : null}

      {/* Zusammenfassung ---------------------------------------------------- */}
      <Section>
        <p className="mb-1.5 text-sm text-ink-muted">{t('doc.section.about')}</p>
        <p className="text-georgian text-[1.02rem] text-ink">{analysis.summary_ka}</p>
      </Section>

      <Section>
        <p className="mb-1.5 text-sm text-ink-muted">{t('doc.section.want')}</p>
        <p className="text-georgian text-[1.02rem] text-ink">{analysis.what_they_want_ka}</p>
      </Section>

      {analysis.amounts.length > 0 ? (
        <Section>
          <p className="mb-2 text-sm text-ink-muted">{t('doc.section.amounts')}</p>
          <Card className="divide-y divide-line px-4">
            {analysis.amounts.map((amount, index) => (
              <div key={index} className="flex items-center justify-between py-3">
                <span className="text-georgian text-sm text-ink-soft">{amount.label_ka}</span>
                <span className="font-display text-[1.05rem] text-ink">
                  {formatMoney(amount.amount_eur)}
                </span>
              </div>
            ))}
          </Card>
        </Section>
      ) : null}

      <GoldRule />

      {/* Nächste Schritte --------------------------------------------------- */}
      {analysis.next_steps_ka.length > 0 ? (
        <Section>
          <p className="mb-3 text-sm text-ink-muted">{t('doc.section.nextSteps')}</p>
          <ol className="space-y-3">
            {analysis.next_steps_ka.map((step, index) => (
              <li key={index} className="flex gap-3">
                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-alubali-soft text-xs font-medium text-alubali">
                  {index + 1}
                </span>
                <span className="text-georgian text-[0.98rem] text-ink-soft">{step}</span>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {analysis.important_ka ? (
        <Section>
          <Card className="bg-gold-soft/50 p-4">
            <div className="flex gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-gold-deep" strokeWidth={1.8} />
              <div>
                <p className="text-sm font-medium text-gold-deep">{t('doc.section.important')}</p>
                <p className="text-georgian mt-1 text-[0.95rem] text-ink-soft">
                  {analysis.important_ka}
                </p>
              </div>
            </div>
          </Card>
        </Section>
      ) : null}

      {/* Hinweis bei sensiblen Inhalten ------------------------------------- */}
      {analysis.advisory_level === 'sensitive' ? (
        <Section>
          <Card className="border-line-strong bg-paper-sunken/70 p-4">
            <div className="flex gap-3">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-ink-muted" strokeWidth={1.8} />
              <div>
                <p className="text-sm font-medium text-ink">{t('doc.advisory.title')}</p>
                <p className="text-georgian mt-1 text-[0.92rem] leading-relaxed text-ink-muted">
                  {t('doc.advisory.body')}
                </p>
              </div>
            </div>
          </Card>
        </Section>
      ) : null}

      {/* Originaltext — bewusst getrennt und zuletzt ------------------------ */}
      {analysis.original_excerpt ? (
        <Section>
          <details className="group">
            <summary className="flex cursor-pointer items-center justify-between py-2 text-sm text-ink-faint">
              {t('doc.section.original')}
              <ChevronRight className="size-4 transition-transform group-open:rotate-90" />
            </summary>
            <p className="mt-2 rounded-card bg-paper-sunken px-4 py-3 text-sm leading-relaxed text-ink-muted">
              {analysis.original_excerpt}
            </p>
          </details>
        </Section>
      ) : null}

      <div className="space-y-2 pt-2">
        <ButtonLink
          href={`/germany/write?document=${document.id}`}
          full
          size="lg"
          className="justify-center"
        >
          <PenLine className="size-4" />
          {t('doc.action.reply')}
        </ButtonLink>
        <ButtonLink href="/germany/document" tone="ghost" full>
          {t('doc.action.newDocument')}
        </ButtonLink>
      </div>
    </Screen>
  )
}
