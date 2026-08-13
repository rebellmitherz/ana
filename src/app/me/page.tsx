import { Heart, Trash2 } from 'lucide-react'
import Link from 'next/link'

import type { PersonalCategory } from '@/core/db/types'
import { formatMoney, type MessageKey } from '@/core/i18n'
import { pageContext } from '@/modules/app/context'
import { listPersonalItems } from '@/modules/personal/service'
import {
  addPersonalItemAction,
  deletePersonalItemAction,
  toggleFavoriteAction,
} from '@/modules/personal/actions'
import { Screen, ScreenHeader, Section } from '@/ui/layout'
import { Card } from '@/ui/primitives'
import { EmptyState } from '@/ui/feedback'
import { AddItemSheet } from './add-item'

export const dynamic = 'force-dynamic'

const CATEGORIES: { value: PersonalCategory; label: MessageKey }[] = [
  { value: 'favorites', label: 'me.collection.favorites' },
  { value: 'wishlist', label: 'me.collection.wishlist' },
  { value: 'restaurant', label: 'me.collection.restaurant' },
  { value: 'beauty', label: 'me.collection.beauty' },
]

export default async function MePage({
  searchParams,
}: {
  searchParams: Promise<{ c?: string }>
}) {
  const { c } = await searchParams
  const { session, t } = await pageContext()

  const active = CATEGORIES.some((entry) => entry.value === c)
    ? (c as PersonalCategory)
    : 'favorites'

  const items = await listPersonalItems(session, active)

  return (
    // Der persönliche Bereich ist spürbar wärmer als der Rest der App.
    <Screen tone="warm">
      <ScreenHeader
        title={t('me.title')}
        subtitle={t('me.subtitle')}
        backHref="/"
        backLabel={t('action.back')}
      />

      <div className="-mx-5 mb-6 flex gap-2 overflow-x-auto px-5 pb-1">
        {CATEGORIES.map((entry) => (
          <Link
            key={entry.value}
            href={`/me?c=${entry.value}`}
            className={`shrink-0 rounded-full px-4 py-2 text-sm transition-all duration-250 ${
              entry.value === active
                ? 'bg-ink text-paper-raised'
                : 'bg-paper-raised text-ink-muted hover:text-ink'
            }`}
          >
            {t(entry.label)}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={<Heart className="size-7" strokeWidth={1.4} />}
          title={t('me.empty')}
          hint={t('me.empty.hint')}
        />
      ) : (
        <Section>
          <div className="grid grid-cols-1 gap-3">
            {items.map((item) => (
              <Card
                key={item.id}
                className="flex items-start justify-between gap-3 border-rose/30 bg-paper-raised p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-georgian font-display text-[1.1rem] leading-snug text-ink">
                    {item.title}
                  </p>
                  {item.note ? (
                    <p className="text-georgian mt-1 text-sm text-ink-muted">{item.note}</p>
                  ) : null}
                  {item.price_eur ? (
                    <p className="mt-1.5 text-sm text-gold-deep">{formatMoney(item.price_eur)}</p>
                  ) : null}
                  {item.url ? (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1.5 inline-block text-xs text-ink-faint underline"
                    >
                      {t('action.open')}
                    </a>
                  ) : null}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <form action={toggleFavoriteAction.bind(null, item.id)}>
                    <button
                      type="submit"
                      aria-label={t('me.collection.favorites')}
                      className={`flex size-9 items-center justify-center rounded-full transition-colors ${
                        item.is_favorite
                          ? 'text-alubali'
                          : 'text-ink-faint hover:text-alubali'
                      }`}
                    >
                      <Heart className={`size-4 ${item.is_favorite ? 'fill-current' : ''}`} />
                    </button>
                  </form>

                  {/* Ein Eintrag lässt sich nicht löschen. 🍒 */}
                  {item.is_locked ? null : (
                    <form action={deletePersonalItemAction.bind(null, item.id)}>
                      <button
                        type="submit"
                        aria-label={t('action.delete')}
                        className="flex size-9 items-center justify-center rounded-full text-ink-faint transition-colors hover:text-critical"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </form>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </Section>
      )}

      <AddItemSheet
        category={active}
        action={addPersonalItemAction}
        labels={{
          add: t('me.add'),
          title: t('me.item.title'),
          note: t('me.item.note'),
          url: t('me.item.url'),
          price: t('me.item.price'),
          save: t('action.save'),
          cancel: t('action.cancel'),
        }}
      />
    </Screen>
  )
}
