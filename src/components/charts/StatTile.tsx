import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Плитка з одним числом. Для однієї величини це чесніша форма, ніж
 * графік з одного стовпчика.
 */
export function StatTile({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string
  value: ReactNode
  hint?: string
  emphasis?: boolean
}) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p
        // Пропорційні цифри, не tabular: вирівнювати тут нічого,
        // а на великому кеглі рівна ширина цифр виглядає розхлябано.
        className={cn('mt-1 font-semibold', emphasis ? 'text-3xl' : 'text-2xl')}
      >
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}
