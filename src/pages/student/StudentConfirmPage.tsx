import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { placeOrder } from '@/api/orders'
import { useStudentDay } from '@/hooks/useStudentDay'
import { humanError } from '@/lib/errors'
import { CATEGORY_LABELS, CATEGORY_ORDER, formatCutoffTime, formatDateWithWeekday } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { ErrorState, LoadingState } from '@/components/common/states'

interface ConfirmState {
  menuDate: string
  menuItemIds: string[]
}

/**
 * Окремий екран підтвердження. Замовлення незмінне, тож зайвий крок тут
 * виправданий: краще одне зайве натискання, ніж «не те замовив і не
 * переробити».
 */
export default function StudentConfirmPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { student, day, items, isPending, error } = useStudentDay()
  const [failure, setFailure] = useState<string | null>(null)

  const state = location.state as ConfirmState | null

  const order = useMutation({
    mutationFn: () => placeOrder(student!.id, state!.menuDate, state!.menuItemIds),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['order'] })
      await queryClient.invalidateQueries({ queryKey: ['orders-of-student'] })
      toast.success('Замовлення прийнято')
      navigate('/me', { replace: true })
    },
    onError: (err) => setFailure(humanError(err, 'Не вдалося зробити замовлення.')),
  })

  // Пряме потрапляння на екран без вибору (перезавантаження сторінки) —
  // повертаємо до меню, а не показуємо порожнечу.
  if (!state) return <Navigate to="/me" replace />
  if (isPending) return <LoadingState />
  if (error) return <ErrorState error={error} />
  if (!student || !day || day.menu_date !== state.menuDate) return <Navigate to="/me" replace />

  const privileged = student.is_privileged
  const chosen = privileged ? items : items.filter((item) => state.menuItemIds.includes(item.id))

  const groups = CATEGORY_ORDER.map((category) => ({
    category,
    items: chosen.filter((item) => item.dishes.category === category),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold">Перевір замовлення</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          на {formatDateWithWeekday(day.menu_date)}, до {formatCutoffTime(day.cutoff_at)}
        </p>
      </div>

      <div className="space-y-3 rounded-xl border p-4">
        {privileged ? (
          <p className="text-sm text-muted-foreground">Повний комплекс:</p>
        ) : null}
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

      <div className="flex items-start gap-2 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <p>Після підтвердження змінити замовлення не можна.</p>
      </div>

      {failure ? <ErrorState error={new Error(failure)} /> : null}

      <div className="space-y-2">
        <Button
          size="lg"
          className="h-14 w-full text-base"
          disabled={order.isPending}
          onClick={() => {
            setFailure(null)
            order.mutate()
          }}
        >
          {order.isPending ? 'Замовляємо…' : 'Підтвердити замовлення'}
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="h-12 w-full"
          disabled={order.isPending}
          onClick={() => navigate('/me')}
        >
          <ArrowLeft className="size-4" aria-hidden />
          Назад до меню
        </Button>
      </div>
    </div>
  )
}
