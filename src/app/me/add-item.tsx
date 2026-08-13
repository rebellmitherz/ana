'use client'

import { Plus, X } from 'lucide-react'
import { useState } from 'react'

import type { PersonalCategory } from '@/core/db/types'
import { Button } from '@/ui/primitives'

/**
 * Hinzufügen im persönlichen Bereich.
 *
 * Bewusst nur ein Pflichtfeld und kein Workflow: Hier gibt es keinen Status,
 * keine Pipeline und kein Business-Vokabular. Nur „+".
 */
export function AddItemSheet({
  category,
  action,
  labels,
}: {
  category: PersonalCategory
  action: (formData: FormData) => Promise<void>
  labels: {
    add: string
    title: string
    note: string
    url: string
    price: string
    save: string
    cancel: string
  }
}) {
  const [open, setOpen] = useState(false)
  const inputClass =
    'w-full rounded-control border border-line bg-paper-raised px-4 py-3 text-[1rem] placeholder:text-ink-faint focus:border-gold focus:outline-none'

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={labels.add}
        className="fixed bottom-6 right-5 z-40 flex size-14 items-center justify-center rounded-full bg-ink text-paper-raised shadow-float transition-transform active:scale-95 mb-safe"
      >
        <Plus className="size-6" strokeWidth={1.8} />
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-ink/20 backdrop-blur-[2px]">
      <div className="w-full rounded-t-sheet border-t border-line bg-paper-raised p-6 pb-safe animate-sheet">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-lg text-ink">{labels.add}</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={labels.cancel}
            className="flex size-10 items-center justify-center rounded-full text-ink-muted hover:bg-paper-sunken"
          >
            <X className="size-5" />
          </button>
        </div>

        <form
          action={async (formData) => {
            await action(formData)
            setOpen(false)
          }}
          className="space-y-3"
        >
          <input type="hidden" name="category" value={category} />
          <input
            name="title"
            required
            autoFocus
            placeholder={labels.title}
            className={inputClass}
          />
          <input name="note" placeholder={labels.note} className={inputClass} />
          <div className="grid grid-cols-2 gap-3">
            <input name="url" placeholder={labels.url} className={inputClass} />
            <input
              name="price"
              type="number"
              inputMode="decimal"
              placeholder={labels.price}
              className={inputClass}
            />
          </div>
          <Button full size="lg" type="submit">
            {labels.save}
          </Button>
        </form>
      </div>
    </div>
  )
}
