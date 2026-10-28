import { CircleCheck, Clock } from 'lucide-react'
import { formatDateWithWeekday } from '@/lib/format'
import type { OrderPlain } from '@/api/orders'

/** Стан «замовлено»: склад і чітко сказано, що змінити його не можна. */
export function OrderedCard({ order }: { order: OrderPlain }) {
  const dishes = order.order_items
    .map((item) => item.menu_items?.dishes)
    .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish))

  const names = dishes
    .map((dish) => dish.name)
    .sort((a, b) => a.localeCompare(b, 'uk'))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 rounded-xl border-2 border-primary bg-primary/5 p-4">
        <CircleCheck className="size-6 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="font-medium">Замовлено</p>
          <p className="text-sm text-muted-foreground">
            на {formatDateWithWeekday(order.menu_date)}
          </p>
        </div>
      </div>

      <ul className="space-y-1">
        {names.map((name) => (
          <li key={name} className="text-base">
            {name}
          </li>
        ))}
      </ul>

      <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
        <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>
          Замовлення змінити не можна. Якщо сталася помилка — скажи класному
          керівнику або адміністратору.
        </p>
      </div>
    </div>
  )
}
