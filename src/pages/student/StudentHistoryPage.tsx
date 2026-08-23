import { useQuery } from '@tanstack/react-query'
import { listOrdersPlainOfStudent } from '@/api/orders'
import { useMyStudent } from '@/hooks/useMyStudent'
import { qk } from '@/lib/queryKeys'
import { CATEGORY_ORDER, formatDateWithWeekday } from '@/lib/format'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'

/** Історія власних замовлень. Тільки читання: замовлення незмінне. */
export default function StudentHistoryPage() {
  const { student, isPending: studentPending, error: studentError } = useMyStudent()

  const ordersQuery = useQuery({
    queryKey: qk.ordersOfStudent(student?.id ?? ''),
    queryFn: () => listOrdersPlainOfStudent(student!.id),
    enabled: Boolean(student),
  })

  if (studentPending || (student && ordersQuery.isPending)) return <LoadingState />
  if (studentError) return <ErrorState error={studentError} />
  if (ordersQuery.error) return <ErrorState error={ordersQuery.error} />

  if (!student) {
    return (
      <EmptyState
        title="Твій акаунт ще не пов’язаний зі списком харчування"
        hint="Скажи про це класному керівнику."
      />
    )
  }

  const orders = ordersQuery.data ?? []

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Мої замовлення</h1>

      {orders.length === 0 ? (
        <EmptyState title="Замовлень ще немає" hint="Зроби перше на вкладці «Меню»." />
      ) : null}

      {orders.map((order) => {
        const dishes = order.order_items
          .map((item) => item.menu_items?.dishes)
          .filter((dish): dish is NonNullable<typeof dish> => Boolean(dish))
          .sort(
            (a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category),
          )

        return (
          <div key={order.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">{formatDateWithWeekday(order.menu_date)}</p>
              {order.privileged_at_order ? <Badge variant="secondary">Комплекс</Badge> : null}
            </div>
            <ul className="mt-2 space-y-0.5 text-sm text-muted-foreground">
              {dishes.map((dish) => (
                <li key={dish.id}>{dish.name}</li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}
