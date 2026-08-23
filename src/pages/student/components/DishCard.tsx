import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Картка страви. Велика зона дотику: цим екраном користуються з телефона,
 * часто на перерві й поспіхом.
 */
export function DishCard({
  name,
  selected,
  onToggle,
}: {
  name: string
  selected: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={cn(
        'flex min-h-16 w-full items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors',
        selected
          ? 'border-primary bg-primary/5 font-medium'
          : 'border-border hover:bg-muted/60 active:bg-muted',
      )}
    >
      <span className="text-base">{name}</span>
      <span
        className={cn(
          'flex size-6 shrink-0 items-center justify-center rounded-full border-2',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-muted-foreground/40',
        )}
        aria-hidden
      >
        {selected ? <Check className="size-4" /> : null}
      </span>
    </button>
  )
}
