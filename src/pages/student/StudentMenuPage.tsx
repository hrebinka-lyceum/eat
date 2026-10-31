import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarOff, Clock, Info, UtensilsCrossed } from 'lucide-react'
import { useStudentDay } from '@/hooks/useStudentDay'
import { formatCutoffTime, formatDateWithWeekday } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/common/states'
import { OrderedCard } from './components/OrderedCard'

/**
 * Екран учня.
 *
 * Блюдо на день одне: їдальня складає його з кількох компонентів, а учень
 * лише вирішує, брати чи ні. Вибору страв тут немає навмисно — інакше
 * довелося б пояснювати дитині, чим «перша страва» відрізняється від
 * «другої», і навіщо вона взагалі має це вирішувати.
 */
export default function StudentMenuPage() {
  const navigate = useNavigate()
  const { student, day, items, order, ordersOpen, isPending, error } = useStudentDay()

  // Блюдо одне, склад — простий перелік компонентів.
  const components = useMemo(
    () =>
      [...items].sort((a, b) => a.dishes.name.localeCompare(b.dishes.name, 'uk')),
    [items],
  )

  if (isPending) return <LoadingState />
  if (error) return <ErrorState error={error} />

  // Учень без картки в списку класу — це не помилка даних, а незавершене
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
  const empty = items.length === 0

  return (
    <div className="space-y-5 pb-24">
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
            Замовити на цей день уже не вийде. Блюдо нижче — просто подивитися.
          </p>
        </div>
      ) : null}

      {empty ? (
        <div className="rounded-xl border-2 border-dashed p-4 text-center">
          <p className="font-medium">Блюдо на цей день ще не складено</p>
          <p className="mt-1 text-sm text-muted-foreground">Загляни трохи пізніше.</p>
        </div>
      ) : (
        <div className="rounded-xl border p-4">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="size-5 text-muted-foreground" aria-hidden />
            <p className="font-medium">Блюдо дня</p>
          </div>

          <ul className="mt-3 space-y-1">
            {components.map((item) => (
              <li key={item.id} className="text-base">
                {item.dishes.name}
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-muted-foreground">
            Блюдо одне на всіх — обирати нічого не треба. Просто скажи, чи будеш.
          </p>
        </div>
      )}

      {!closed && !empty ? (
        <div className="fixed inset-x-0 bottom-16 z-10 border-t bg-background p-3">
          <div className="mx-auto max-w-md">
            <Button
              size="lg"
              className="h-14 w-full text-base"
              onClick={() =>
                navigate('/me/confirm', {
                  state: {
                    menuDate: day.menu_date,
                    // Блюдо замовляється цілком: усі компоненти дня.
                    menuItemIds: items.map((item) => item.id),
                  },
                })
              }
            >
              Замовити
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
