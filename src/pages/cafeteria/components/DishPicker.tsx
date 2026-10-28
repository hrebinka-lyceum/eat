import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'

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

  // Категорій більше немає — просто список компонентів за абеткою.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return dishes
      .filter((dish) => !term || dish.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  }, [dishes, search])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Додати компонент</CardTitle>
        <CardDescription>Склад блюда — довільний: каша, котлета, чай, фрукти.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="pl-8"
            placeholder="Пошук компонента"
            aria-label="Пошук компонента"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {visible.length === 0 ? (
          <EmptyState
            title="Немає активних компонентів"
            hint="Додайте їх у довіднику — далі вони з’являться тут."
          />
        ) : null}

        <div className="max-h-[28rem] space-y-1 overflow-y-auto pr-1">
          {visible.map((dish) => {
            const used = usedDishIds.has(dish.id)
            return (
              <div
                key={dish.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
              >
                <p className="min-w-0 truncate text-sm">{dish.name}</p>
                <Button
                  size="sm"
                  variant={used ? 'ghost' : 'outline'}
                  disabled={used || disabled}
                  aria-label={`Додати ${dish.name} до блюда`}
                  onClick={() => onAdd(dish)}
                >
                  {used ? (
                    <>
                      <Check className="size-4" aria-hidden />
                      У блюді
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

      </CardContent>
    </Card>
  )
}
