import { cn } from '@/ui/cn'

/**
 * Statusleiste statt Kanban.
 *
 * Kanban ist auf 390 px Breite unbedienbar. Diese Leiste zeigt denselben
 * Fortschritt in einer Zeile — und der Status wechselt durch Handlungen, nicht
 * durch ein Dropdown. Niemand pflegt gerne Statusfelder.
 */
export function StatusRail({
  steps,
  current,
}: {
  steps: { key: string; label: string }[]
  current: string
}) {
  const index = steps.findIndex((step) => step.key === current)
  const activeIndex = index === -1 ? 0 : index
  const currentStep = steps[activeIndex]

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {steps.map((step, position) => {
          const done = position < activeIndex
          const active = position === activeIndex
          return (
            <div key={step.key} className="flex flex-1 items-center gap-1.5">
              <span
                className={cn(
                  'h-1 flex-1 rounded-full transition-colors duration-500',
                  done && 'bg-alubali/45',
                  active && 'bg-alubali',
                  !done && !active && 'bg-paper-sunken',
                )}
              />
            </div>
          )
        })}
      </div>
      <p className="mt-2.5 text-sm text-ink-soft">{currentStep?.label ?? ''}</p>
    </div>
  )
}
