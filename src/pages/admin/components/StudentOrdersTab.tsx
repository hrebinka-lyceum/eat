import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Clock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { areOrdersOpen, listMenuDays, listMenuItemsPlain, type MenuItemPlain } from '@/api/menu'
import { cancelOrder, listOrdersPlainOfStudent, placeOrder } from '@/api/orders'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { shiftIso } from '@/lib/dates'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MENU_STATUS_LABELS,
  formatCutoff,
  formatDateWithWeekday,
  toIsoDate,
} from '@/lib/format'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Student } from '@/types/database'

const SINGLE_CHOICE = ['first', 'second']
const DAYS_AHEAD = 30

/**
 * Замовлення за учня й скасування.
 *
 * Адміністрація може замовити будь-коли, зокрема на сьогодні після дедлайну —
 * так вирішує place_order. Такі замовлення сервер сам позначає after_cutoff,
 * і в списку вони видно окремо.
 */
export function StudentOrdersTab({ student }: { student: Student }) {
  const queryClient = useQueryClient()
  const today = toIsoDate()
  const [date, setDate] = useState<string | null>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const [toCancel, setToCancel] = useState<string | null>(null)

  const daysQuery = useQuery({
    queryKey: qk.menuDays(today, shiftIso(today, DAYS_AHEAD)),
    queryFn: () => listMenuDays(today, shiftIso(today, DAYS_AHEAD)),
  })

  const activeDate = date ?? daysQuery.data?.[0]?.menu_date ?? null
  const activeDay = daysQuery.data?.find((day) => day.menu_date === activeDate) ?? null

  const itemsQuery = useQuery({
    queryKey: qk.menuItemsPlain(activeDate ?? ''),
    queryFn: () => listMenuItemsPlain(activeDate!),
    enabled: Boolean(activeDate),
  })

  const openQuery = useQuery({
    queryKey: qk.ordersOpen(activeDate ?? ''),
    queryFn: () => areOrdersOpen(activeDate!),
    enabled: Boolean(activeDate),
  })

  const ordersQuery = useQuery({
    queryKey: qk.ordersOfStudent(student.id),
    queryFn: () => listOrdersPlainOfStudent(student.id, 30),
  })

  const orders = ordersQuery.data ?? []
  const alreadyOrdered = orders.some((order) => order.menu_date === activeDate)
  const willBeLate = openQuery.data === false

  const groups = useMemo(() => {
    const items = itemsQuery.data ?? []
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: items
        .filter((item) => item.dishes.category === category)
        .sort((a, b) => a.dishes.name.localeCompare(b.dishes.name, 'uk')),
    })).filter((group) => group.items.length > 0)
  }, [itemsQuery.data])

  const toggle = (item: MenuItemPlain) => {
    setChosen((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id)
      if (SINGLE_CHOICE.includes(item.dishes.category)) {
        const sameCategory = (itemsQuery.data ?? [])
          .filter((other) => other.dishes.category === item.dishes.category)
          .map((other) => other.id)
        return [...current.filter((id) => !sameCategory.includes(id)), item.id]
      }
      return [...current, item.id]
    })
  }

  const submit = useMutation({
    mutationFn: () => placeOrder(student.id, activeDate!, chosen),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders-of-student'] })
      await queryClient.invalidateQueries({ queryKey: ['orders-of-class'] })
      setChosen([])
      toast.success('Замовлення створено')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const cancel = useMutation({
    mutationFn: (orderId: string) => cancelOrder(orderId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['orders-of-student'] })
      await queryClient.invalidateQueries({ queryKey: ['orders-of-class'] })
      setToCancel(null)
      toast.success('Замовлення скасовано')
    },
    onError: (err) => {
      toast.error(humanError(err))
      setToCancel(null)
    },
  })

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <h3 className="text-sm font-medium">Замовити за учня</h3>

        {daysQuery.isPending ? <LoadingState /> : null}
        {daysQuery.error ? <ErrorState error={daysQuery.error} /> : null}

        {!daysQuery.isPending && (daysQuery.data ?? []).length === 0 ? (
          <EmptyState
            title="Немає днів меню на найближчий місяць"
            hint="Спершу їдальня має створити дні меню."
          />
        ) : null}

        {activeDate ? (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-2">
                <Label htmlFor="order-day">День</Label>
                <Select
                  value={activeDate}
                  onValueChange={(value) => {
                    setDate(value)
                    setChosen([])
                  }}
                >
                  <SelectTrigger id="order-day" className="w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(daysQuery.data ?? []).map((day) => (
                      <SelectItem key={day.menu_date} value={day.menu_date}>
                        {formatDateWithWeekday(day.menu_date)}
                        {day.status === 'published' ? '' : ` — ${MENU_STATUS_LABELS[day.status]}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeDay ? (
                <p className="pb-2 text-xs text-muted-foreground">
                  Прийом до {formatCutoff(activeDay.cutoff_at)}
                </p>
              ) : null}
            </div>

            {alreadyOrdered ? (
              <Alert>
                <CircleCheck className="size-4" aria-hidden />
                <AlertTitle>На цей день замовлення вже є</AlertTitle>
                <AlertDescription>
                  Замовлення незмінне. Щоб змінити склад, спершу скасуйте наявне —
                  воно нижче в історії.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {willBeLate ? (
                  <Alert>
                    <Clock className="size-4" aria-hidden />
                    <AlertTitle>Час прийому замовлень на цей день минув</AlertTitle>
                    <AlertDescription>
                      Ви можете замовити попри це, але сервер позначить замовлення як
                      пізнє — воно окремо видно і в кухонному аркуші, і в звітах.
                    </AlertDescription>
                  </Alert>
                ) : null}

                <div className="space-y-3">
                    {itemsQuery.isPending ? <LoadingState /> : null}
                    {groups.length === 0 && !itemsQuery.isPending ? (
                      <p className="text-sm text-muted-foreground">
                        У меню на цей день немає страв.
                      </p>
                    ) : null}
                    {groups.map((group) => (
                      <div key={group.category}>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {CATEGORY_LABELS[group.category]}
                          {SINGLE_CHOICE.includes(group.category) ? ' — одна страва' : ''}
                        </p>
                        <div className="mt-1 space-y-1">
                          {group.items.map((item) => (
                            <label
                              key={item.id}
                              className="flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm"
                            >
                              <Checkbox
                                checked={chosen.includes(item.id)}
                                onCheckedChange={() => toggle(item)}
                              />
                              {item.dishes.name}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>

                <Button
                  disabled={
                    submit.isPending ||
                    chosen.length === 0 ||
                    (itemsQuery.data ?? []).length === 0
                  }
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending ? 'Замовляємо…' : 'Замовити'}
                </Button>
              </>
            )}
          </>
        ) : null}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-medium">Історія замовлень</h3>

        {ordersQuery.isPending ? <LoadingState /> : null}
        {ordersQuery.error ? <ErrorState error={ordersQuery.error} /> : null}

        {orders.length === 0 && !ordersQuery.isPending ? (
          <p className="text-sm text-muted-foreground">Замовлень ще немає.</p>
        ) : null}

        <div className="space-y-2">
          {orders.map((order) => {
            const dishes = order.order_items
              .map((item) => item.menu_items?.dishes.name)
              .filter((name): name is string => Boolean(name))

            return (
              <div
                key={order.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{formatDateWithWeekday(order.menu_date)}</span>
                    {order.privileged_at_order ? (
                      <Badge variant="secondary">Пільгове</Badge>
                    ) : null}
                    {order.after_cutoff ? <Badge variant="secondary">Пізнє</Badge> : null}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {dishes.join(', ') || 'склад невідомий'}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setToCancel(order.id)}
                  disabled={cancel.isPending}
                >
                  <Trash2 className="size-4" aria-hidden />
                  Скасувати
                </Button>
              </div>
            )
          })}
        </div>
      </section>

      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
        title="Скасувати замовлення?"
        description="Замовлення зникне разом зі складом. Якщо кухня вже порахувала порції на цей день, попередьте її окремо."
        confirmLabel="Скасувати замовлення"
        destructive
        busy={cancel.isPending}
        onConfirm={() => toCancel && cancel.mutate(toCancel)}
      />
    </div>
  )
}
