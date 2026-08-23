import { CircleCheck, Clock } from 'lucide-react'
import { CATEGORY_LABELS, CATEGORY_ORDER, formatDateWithWeekday } from '@/lib/format'
import type { OrderPlain } from '@/api/orders'

/** Стан «замовлено»: склад і чітко сказано, що змінити його не можна. */
export function OrderedCard({ order }: { order: OrderPlain }) {
  const dishes = order.order_items
    .map((item) => item.menu_items?.dishes)
    .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish))

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: dishes.filter((dish) => dish.category === category),
  })).filter((group) => group.items.length > 0)

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

      {order.privileged_at_order ? (
        <p className="text-sm text-muted-foreground">Тобі покладений повний комплекс.</p>
      ) : null}

      <div className="space-y-3">
        {groups.map((group) => (
          <div key={group.category}>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {CATEGORY_LABELS[group.category]}
            </p>
            <ul className="mt-1 space-y-0.5">
              {group.items.map((dish) => (
                <li key={dish.id} className="text-base">
                  {dish.name}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

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
