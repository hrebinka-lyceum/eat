import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import { normalizeComponentName } from '@/api/dishes'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/common/states'
import type { Dish } from '@/types/database'

/**
 * Додавання компонента в блюдо: знайшов — натиснув. Два кліки, як і має бути
 * в щоденній роботі. Якщо такого компонента ще немає, його можна створити
 * просто звідси — він з'явиться і в блюді, і в довіднику.
 */
export function DishPicker({
  dishes,
  usedDishIds,
  disabled,
  onAdd,
  onCreate,
}: {
  dishes: Dish[]
  usedDishIds: Set<string>
  disabled?: boolean
  onAdd: (dish: Dish) => void
  /** Новий компонент за назвою; після успіху пошук очищається. */
  onCreate: (name: string) => Promise<unknown>
}) {
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  // Категорій більше немає — просто список компонентів за абеткою.
  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return dishes
      .filter((dish) => !term || dish.name.toLowerCase().includes(term))
      .sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  }, [dishes, search])

  // Пропонуємо створити, лише коли точно такого компонента немає: «Чай» не
  // має ставати новим тільки тому, що в списку є ще й «Чай з лимоном».
  const newName = normalizeComponentName(search)
  const exactExists = dishes.some(
    (dish) => dish.name.toLocaleLowerCase('uk') === newName.toLocaleLowerCase('uk'),
  )
  const canCreate = newName.length > 0 && !exactExists

  const create = async () => {
    if (!canCreate || creating || disabled) return
    setCreating(true)
    try {
      await onCreate(newName)
      setSearch('')
    } catch {
      // Помилку вже показав редактор; назву лишаємо, щоб не набирати знову.
    } finally {
      setCreating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Додати компонент</CardTitle>
        <CardDescription>
          Знайдіть у списку або впишіть нову назву — новий компонент додасться і до блюда,
          і в довідник.
        </CardDescription>
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
            onKeyDown={(e) => {
              // Enter створює лише тоді, коли нічого не знайдено, — інакше
              // легко випадково додати дубль замість наявного компонента.
              if (e.key === 'Enter' && visible.length === 0) {
                e.preventDefault()
                void create()
              }
            }}
          />
        </div>

        {visible.length === 0 && !canCreate ? (
          <EmptyState
            title="Компонентів ще немає"
            hint="Почніть вводити назву — новий компонент можна додати просто звідси."
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

        {/* Під списком, а не над ним: поки набирають «Чай з…», першим має
            бути наявний «Чай з лимоном», а не пропозиція створити дубль. */}
        {canCreate ? (
          <Button
            variant="secondary"
            className="h-auto w-full justify-start whitespace-normal py-2 text-left"
            disabled={disabled || creating}
            onClick={() => void create()}
          >
            <Plus className="size-4 shrink-0" aria-hidden />
            <span>
              {creating ? 'Додаємо…' : <>Додати «{newName}» як новий компонент</>}
            </span>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  )
}
