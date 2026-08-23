import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { CATEGORY_LABELS, CATEGORY_ORDER, formatMoney } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/states'
import type { Dish } from '@/types/database'

/**
 * Додавання страви в меню: знайшов — натиснув. Два кліки, як і має бути
 * в щоденній роботі.
 */
export function DishPicker({
  dishes,
  usedDishIds,
  disabled,
  onAdd,
}: {
  dishes: Dish[]
  usedDishIds: Set<string>
  disabled?: boolean
  onAdd: (dish: Dish) => void
}) {
  const [search, setSearch] = useState('')

  const grouped = useMemo(() => {
    const term = search.trim().toLowerCase()
    const matching = dishes.filter((dish) => !term || dish.name.toLowerCase().includes(term))
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: matching.filter((dish) => dish.category === category),
    })).filter((group) => group.items.length > 0)
  }, [dishes, search])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Додати страву</CardTitle>
        <CardDescription>Ціна підставиться з довідника.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder="Пошук страви"
            aria-label="Пошук страви"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {grouped.length === 0 ? (
          <EmptyState
            title="Немає активних страв"
            hint="Додайте страви в довіднику — далі вони з’являться тут."
          />
        ) : null}

        <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
          {grouped.map((group) => (
            <div key={group.category}>
              <p className="pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {CATEGORY_LABELS[group.category]}
              </p>
              <div className="space-y-1">
                {group.items.map((dish) => {
                  const used = usedDishIds.has(dish.id)
                  return (
                    <div
                      key={dish.id}
                      className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm">{dish.name}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {formatMoney(dish.price)}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant={used ? 'ghost' : 'outline'}
                        disabled={used || disabled}
                        aria-label={`Додати ${dish.name} до меню`}
                        onClick={() => onAdd(dish)}
                      >
                        {used ? (
                          <>
                            <Check className="size-4" aria-hidden />
                            У меню
                          </>
                        ) : (
                          <>
                            <Plus className="size-4" aria-hidden />
                            Додати
                          </>
                        )}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
