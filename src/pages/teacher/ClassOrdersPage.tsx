import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Star, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { areOrdersOpen, listMenuItemsPlain, type MenuItemPlain } from '@/api/menu'
import { listOrdersPlainOfClass, placeOrder } from '@/api/orders'
import { listStudentsOfClass } from '@/api/students'
import { useMyClass } from '@/hooks/useMyClass'
import { usePublishedDays } from '@/hooks/usePublishedDays'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { csvFilename } from '@/lib/csv'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatCutoff,
  formatDateWithWeekday,
  fullName,
} from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PublishedDaySelect } from './components/PublishedDaySelect'
import type { Student } from '@/types/database'

/** Обрані страви за учнями. Ключ є — учень бере участь у замовленні. */
type Selection = Record<string, string[]>

const SINGLE_CHOICE = ['first', 'second']

export default function ClassOrdersPage() {
  const queryClient = useQueryClient()
  const { myClass, isPending: classPending, error: classError } = useMyClass()
  const { days, isPending: daysPending } = usePublishedDays()
  const [day, setDay] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>({})
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [failures, setFailures] = useState<Array<{ name: string; reason: string }>>([])

  const activeDay = day ?? days[0]?.menu_date ?? null
  const dayInfo = days.find((d) => d.menu_date === activeDay) ?? null

  const studentsQuery = useQuery({
    queryKey: qk.students(myClass?.id ?? ''),
    queryFn: () => listStudentsOfClass(myClass!.id),
    enabled: Boolean(myClass),
  })

  const itemsQuery = useQuery({
    queryKey: qk.menuItemsPlain(activeDay ?? ''),
    queryFn: () => listMenuItemsPlain(activeDay!),
    enabled: Boolean(activeDay),
  })

  const ordersQuery = useQuery({
    queryKey: qk.ordersOfClass(myClass?.id ?? '', activeDay ?? ''),
    queryFn: () => listOrdersPlainOfClass(myClass!.id, activeDay!),
    enabled: Boolean(myClass) && Boolean(activeDay),
  })

  // Дедлайн — рішення сервера, а не годинника цього комп'ютера.
  const openQuery = useQuery({
    queryKey: qk.ordersOpen(activeDay ?? ''),
    queryFn: () => areOrdersOpen(activeDay!),
    enabled: Boolean(activeDay),
    staleTime: 60_000,
  })

  const students = studentsQuery.data ?? []
  const items = useMemo(
    () =>
      [...(itemsQuery.data ?? [])].sort((a, b) => {
        const byCategory =
          CATEGORY_ORDER.indexOf(a.dishes.category) - CATEGORY_ORDER.indexOf(b.dishes.category)
        return byCategory !== 0 ? byCategory : a.dishes.name.localeCompare(b.dishes.name, 'uk')
      }),
    [itemsQuery.data],
  )

  const ordersByStudent = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const order of ordersQuery.data ?? []) {
      map.set(
        order.student_id,
        order.order_items
          .map((item) => item.menu_items?.dishes.name)
          .filter((name): name is string => Boolean(name)),
      )
    }
    return map
  }, [ordersQuery.data])

  const closed = openQuery.data === false
  const pending = students.filter((student) => !ordersByStudent.has(student.id))
  const chosenCount = Object.keys(selection).length

  const toggleDish = (student: Student, item: MenuItemPlain) => {
    setSelection((current) => {
      const currentIds = current[student.id] ?? []
      let nextIds: string[]

      if (currentIds.includes(item.id)) {
        nextIds = currentIds.filter((id) => id !== item.id)
      } else if (SINGLE_CHOICE.includes(item.dishes.category)) {
        // Одне перше й одне друге — те саме правило перевіряє place_order.
        const sameCategory = items
          .filter((other) => other.dishes.category === item.dishes.category)
          .map((other) => other.id)
        nextIds = [...currentIds.filter((id) => !sameCategory.includes(id)), item.id]
      } else {
        nextIds = [...currentIds, item.id]
      }

      const next = { ...current }
      if (nextIds.length === 0) delete next[student.id]
      else next[student.id] = nextIds
      return next
    })
  }

  const togglePrivileged = (student: Student, include: boolean) => {
    setSelection((current) => {
      const next = { ...current }
      if (include) next[student.id] = []
      else delete next[student.id]
      return next
    })
  }

  /** Відмітити страву всім, хто ще не замовив. Пільгових це не стосується. */
  const assignToAll = (item: MenuItemPlain) => {
    setSelection((current) => {
      const next = { ...current }
      for (const student of pending) {
        if (student.is_privileged) continue
        const currentIds = next[student.id] ?? []
        if (currentIds.includes(item.id)) continue
        if (SINGLE_CHOICE.includes(item.dishes.category)) {
          const sameCategory = items
            .filter((other) => other.dishes.category === item.dishes.category)
            .map((other) => other.id)
          next[student.id] = [...currentIds.filter((id) => !sameCategory.includes(id)), item.id]
        } else {
          next[student.id] = [...currentIds, item.id]
        }
      }
      return next
    })
  }

  const submit = useMutation({
    mutationFn: async () => {
      const entries = Object.entries(selection)
      const failed: Array<{ name: string; reason: string }> = []
      let ok = 0

      // Послідовно: кожне замовлення — окремий виклик place_order, і треба
      // знати, яке саме не пройшло.
      for (const [studentId, menuItemIds] of entries) {
        const student = students.find((s) => s.id === studentId)
        try {
          await placeOrder(studentId, activeDay!, menuItemIds)
          ok += 1
        } catch (err) {
          failed.push({
            name: student ? fullName(student.last_name, student.first_name) : 'Учень',
            reason: humanError(err),
          })
        }
      }
      return { ok, failed }
    },
    onSuccess: async ({ ok, failed }) => {
      await queryClient.invalidateQueries({ queryKey: ['orders-of-class'] })
      setConfirmOpen(false)
      setFailures(failed)
      setSelection({})
      if (ok > 0) toast.success(`Замовлено для ${ok} ${ok === 1 ? 'учня' : 'учнів'}`)
      if (failed.length > 0) toast.error(`Не вдалося: ${failed.length}`)
    },
    onError: (err) => {
      setConfirmOpen(false)
      toast.error(humanError(err))
    },
  })

  if (classPending) return <LoadingState />
  if (classError) return <ErrorState error={classError} />

  if (!myClass) {
    return (
      <div className="space-y-6">
        <PageHeader title="Замовлення класу" />
        <EmptyState
          title="За вами не закріплено клас у поточному навчальному році"
          hint="Зверніться до адміністрації."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Замовлення класу"
        description="Відмітьте страви й замовте одразу для кількох учнів."
        actions={
          <ExportButton
            rows={students}
            filename={csvFilename(`замовлення-${myClass.name}`, activeDay ?? undefined)}
            columns={[
              { header: 'Учень', value: (s) => fullName(s.last_name, s.first_name) },
              { header: 'Пільга', value: (s) => s.is_privileged },
              {
                header: 'Замовлення',
                value: (s) => (ordersByStudent.get(s.id) ?? []).join(', '),
              },
            ]}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <PublishedDaySelect
          days={days}
          value={activeDay}
          onChange={(value) => {
            setDay(value)
            setSelection({})
            setFailures([])
          }}
        />
        {dayInfo ? (
          <p className="pb-2 text-sm text-muted-foreground">
            Замовлення приймаються до {formatCutoff(dayInfo.cutoff_at)}
          </p>
        ) : null}
      </div>

      {daysPending ? <LoadingState /> : null}

      {!daysPending && days.length === 0 ? (
        <EmptyState
          title="Немає опублікованих днів"
          hint="Замовляти можна лише на дні, які їдальня вже опублікувала."
        />
      ) : null}

      {closed ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>Час прийому замовлень на цей день минув</AlertTitle>
          <AlertDescription>
            Нижче видно, хто вже замовив. Додати замовлення заднім числом може лише
            адміністратор.
          </AlertDescription>
        </Alert>
      ) : null}

      {failures.length > 0 ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>Частина замовлень не пройшла</AlertTitle>
          <AlertDescription>
            <ul className="mt-1 space-y-0.5">
              {failures.map((failure) => (
                <li key={failure.name}>
                  <strong>{failure.name}</strong> — {failure.reason}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      {studentsQuery.error ? <ErrorState error={studentsQuery.error} /> : null}
      {itemsQuery.error ? <ErrorState error={itemsQuery.error} /> : null}

      {activeDay && (studentsQuery.isPending || itemsQuery.isPending) ? <LoadingState /> : null}

      {activeDay && students.length === 0 && !studentsQuery.isPending ? (
        <EmptyState
          title="У реєстрі класу ще нікого немає"
          hint="Спершу додайте на вкладці «Мій клас» тих, хто харчується."
        />
      ) : null}

      {activeDay && students.length > 0 && items.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-48">Учень</TableHead>
                {items.map((item) => (
                  <TableHead key={item.id} className="min-w-28 align-bottom">
                    <div className="space-y-1">
                      <p className="text-[0.65rem] uppercase tracking-wide text-muted-foreground">
                        {CATEGORY_LABELS[item.dishes.category]}
                      </p>
                      <p className="font-medium text-foreground">{item.dishes.name}</p>
                      {!closed ? (
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => assignToAll(item)}
                          disabled={pending.length === 0}
                        >
                          усім
                        </Button>
                      ) : null}
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map((student) => {
                const ordered = ordersByStudent.get(student.id)
                const chosen = selection[student.id]

                if (ordered) {
                  return (
                    <TableRow key={student.id} className="bg-muted/30">
                      <TableCell className="font-medium">
                        {fullName(student.last_name, student.first_name)}
                      </TableCell>
                      <TableCell colSpan={items.length}>
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <CircleCheck className="size-4 text-primary" aria-hidden />
                          Замовлено: {ordered.join(', ') || 'комплекс'}
                        </span>
                      </TableCell>
                    </TableRow>
                  )
                }

                if (student.is_privileged) {
                  return (
                    <TableRow key={student.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {fullName(student.last_name, student.first_name)}
                          <Badge variant="secondary">
                            <Star className="size-3" aria-hidden />
                            Пільга
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell colSpan={items.length}>
                        <label className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={chosen !== undefined}
                            disabled={closed}
                            onCheckedChange={(value) => togglePrivileged(student, value === true)}
                          />
                          Комплекс — обирати страви не потрібно
                        </label>
                      </TableCell>
                    </TableRow>
                  )
                }

                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {fullName(student.last_name, student.first_name)}
                    </TableCell>
                    {items.map((item) => (
                      <TableCell key={item.id}>
                        <Checkbox
                          checked={(chosen ?? []).includes(item.id)}
                          disabled={closed}
                          aria-label={`${item.dishes.name} для ${student.last_name}`}
                          onCheckedChange={() => toggleDish(student, item)}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      {activeDay && items.length === 0 && !itemsQuery.isPending ? (
        <EmptyState
          title="У меню на цей день немає страв"
          hint="Зверніться до працівника їдальні."
        />
      ) : null}

      {chosenCount > 0 && !closed ? (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-sm">
          <p className="text-sm">
            Обрано учнів: <strong>{chosenCount}</strong>
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelection({})}>
              Зняти вибір
            </Button>
            <Button onClick={() => setConfirmOpen(true)}>Замовити</Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Замовити для ${chosenCount} ${chosenCount === 1 ? 'учня' : 'учнів'}?`}
        description={
          <>
            {activeDay ? `На ${formatDateWithWeekday(activeDay)}. ` : ''}
            Замовлення незмінне: після підтвердження виправити склад не можна —
            лише адміністратор зможе його скасувати.
          </>
        }
        confirmLabel="Замовити"
        busy={submit.isPending}
        onConfirm={() => submit.mutate()}
      />
    </div>
  )
}
