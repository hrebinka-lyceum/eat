import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarOff, Clock, Info } from 'lucide-react'
import { useStudentDay } from '@/hooks/useStudentDay'
import { CATEGORY_LABELS, CATEGORY_ORDER, formatCutoffTime, formatDateWithWeekday } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/common/states'
import { DishCard } from './components/DishCard'
import { OrderedCard } from './components/OrderedCard'
import type { MenuItemPlain } from '@/api/menu'

/** У цих категоріях можна обрати лише одну страву — так само вважає сервер. */
const SINGLE_CHOICE: Array<MenuItemPlain['dishes']['category']> = ['first', 'second']

export default function StudentMenuPage() {
  const navigate = useNavigate()
  const { student, day, items, order, ordersOpen, isPending, error } = useStudentDay()
  const [selected, setSelected] = useState<string[]>([])

  const groups = useMemo(
    () =>
      CATEGORY_ORDER.map((category) => ({
        category,
        items: items
          .filter((item) => item.dishes.category === category)
          .sort((a, b) => a.dishes.name.localeCompare(b.dishes.name, 'uk')),
      })).filter((group) => group.items.length > 0),
    [items],
  )

  if (isPending) return <LoadingState />
  if (error) return <ErrorState error={error} />

  // Учень без картки в реєстрі — це не помилка даних, а незавершене
  // налаштування. Пояснюємо, до кого йти.
  if (!student) {
    return (
      <div className="space-y-3 rounded-xl border p-5 text-center">
        <Info className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="font-medium">Твій акаунт ще не пов’язаний зі списком харчування</p>
        <p className="text-sm text-muted-foreground">
          Скажи про це класному керівнику — він додасть тебе, і меню з’явиться тут.
        </p>
      </div>
    )
  }

  if (!day) {
    return (
      <div className="space-y-3 rounded-xl border p-5 text-center">
        <CalendarOff className="mx-auto size-6 text-muted-foreground" aria-hidden />
        <p className="font-medium">Меню ще немає</p>
        <p className="text-sm text-muted-foreground">
          Коли їдальня опублікує меню на найближчий день, воно з’явиться тут.
        </p>
      </div>
    )
  }

  if (order) return <OrderedCard order={order} />

  const closed = ordersOpen === false
  const toggle = (item: MenuItemPlain) => {
    const category = item.dishes.category
    setSelected((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id)
      if (SINGLE_CHOICE.includes(category)) {
        const sameCategory = items
          .filter((other) => other.dishes.category === category)
          .map((other) => other.id)
        return [...current.filter((id) => !sameCategory.includes(id)), item.id]
      }
      return [...current, item.id]
    })
  }

  const goToConfirm = (ids: string[]) => {
    navigate('/me/confirm', { state: { menuDate: day.menu_date, menuItemIds: ids } })
  }

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-lg font-semibold">{formatDateWithWeekday(day.menu_date)}</h1>
        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Clock className="size-4" aria-hidden />
          Замовлення приймаються до {formatCutoffTime(day.cutoff_at)}
        </p>
      </div>

      {closed ? (
        <div className="rounded-xl border-2 border-dashed p-4 text-center">
          <p className="font-medium">Час прийому замовлень минув</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Замовити на цей день уже не вийде. Меню нижче — просто подивитися.
          </p>
        </div>
      ) : null}

      {student.is_privileged ? (
        // Пільговому вибору немає: комплекс покладений повністю.
        <div className="space-y-4">
          <div className="rounded-xl border p-4">
            <p className="font-medium">Тобі покладений повний комплекс</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Обирати нічого не треба — ось що буде в цей день:
            </p>
            <div className="mt-3 space-y-3">
              {groups.map((group) => (
                <div key={group.category}>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[group.category]}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {group.items.map((item) => (
                      <li key={item.id} className="text-base">
                        {item.dishes.name}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {!closed ? (
            <Button
              size="lg"
              className="h-14 w-full text-base"
              disabled={items.length === 0}
              onClick={() => goToConfirm([])}
            >
              Замовити
            </Button>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-5">
            {groups.map((group) => (
              <div key={group.category} className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {CATEGORY_LABELS[group.category]}
                  {SINGLE_CHOICE.includes(group.category) ? ' — одна страва' : ''}
                </p>
                {group.items.map((item) => (
                  <DishCard
                    key={item.id}
                    name={item.dishes.name}
                    selected={selected.includes(item.id)}
                    onToggle={() => (closed ? undefined : toggle(item))}
                  />
                ))}
              </div>
            ))}
          </div>

          {!closed ? (
            <div className="fixed inset-x-0 bottom-16 z-10 border-t bg-background p-3">
              <div className="mx-auto max-w-md">
                <Button
                  size="lg"
                  className="h-14 w-full text-base"
                  disabled={selected.length === 0}
                  onClick={() => goToConfirm(selected)}
                >
                  {selected.length === 0 ? 'Обери страви' : `Далі — обрано ${selected.length}`}
                </Button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
