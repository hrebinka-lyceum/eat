import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Star, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { areOrdersOpen, listMenuItemsPlain } from '@/api/menu'
import { listOrdersPlainOfClass, placeOrder } from '@/api/orders'
import { listStudentsOfClass } from '@/api/students'
import { useMyClass } from '@/hooks/useMyClass'
import { usePublishedDays } from '@/hooks/usePublishedDays'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { csvFilename } from '@/lib/csv'
import {
  formatCutoff,
  formatDateWithWeekday,
  fullName,
  plural,
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

/**
 * Обрані учні. Блюдо одне на всіх, тож вибирати нічого, крім «буде / не буде»:
 * кожному обраному замовляється весь склад дня.
 */
type Selection = Set<string>

export default function ClassOrdersPage() {
  const queryClient = useQueryClient()
  const { myClass, isPending: classPending, error: classError } = useMyClass()
  const { days, isPending: daysPending } = usePublishedDays()
  const [day, setDay] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection>(new Set())
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
      [...(itemsQuery.data ?? [])].sort((a, b) =>
        a.dishes.name.localeCompare(b.dishes.name, 'uk'),
      ),
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

  const chosenCountLabel = plural(selection.size, 'учня', 'учнів', 'учнів')

  const toggleStudent = (studentId: string, include: boolean) => {
    setSelection((current) => {
      const next = new Set(current)
      if (include) next.add(studentId)
      else next.delete(studentId)
      return next
    })
  }

  /** Відмітити всіх, хто ще не замовив, — типова дія перед першим уроком. */
  const toggleAll = (include: boolean) => {
    setSelection(include ? new Set(pending.map((student) => student.id)) : new Set())
  }

  const submit = useMutation({
    mutationFn: async () => {
      const failed: Array<{ name: string; reason: string }> = []
      const menuItemIds = items.map((item) => item.id)
      let ok = 0

      // Послідовно: кожне замовлення — окремий виклик place_order, і треба
      // знати, яке саме не пройшло.
      for (const studentId of selection) {
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
      setSelection(new Set())
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
        description="Блюдо одне на всіх — відмітьте, хто буде їсти."
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
            setSelection(new Set())
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
        <>
          {/* Керівник має бачити, що саме він замовляє, — склад дня один на всіх. */}
          <div className="rounded-lg border p-3">
            <p className="text-sm font-medium">Блюдо на цей день</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.map((item) => item.dishes.name).join(' · ')}
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-56">Учень</TableHead>
                  <TableHead className="w-56">
                    <div className="flex items-center gap-3">
                      <span>Буде їсти</span>
                      {!closed && pending.length > 0 ? (
                        <Checkbox
                          aria-label="Обрати всіх, хто ще не замовив"
                          checked={selection.size > 0 && selection.size === pending.length}
                          onCheckedChange={(value) => toggleAll(value === true)}
                        />
                      ) : null}
                    </div>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map((student) => {
                  const ordered = ordersByStudent.get(student.id)

                  return (
                    <TableRow key={student.id} className={ordered ? 'bg-muted/30' : undefined}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {fullName(student.last_name, student.first_name)}
                          {student.is_privileged ? (
                            <Badge variant="secondary">
                              <Star className="size-3" aria-hidden />
                              Пільга
                            </Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell>
                        {ordered ? (
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <CircleCheck className="size-4 text-primary" aria-hidden />
                            Замовлено
                          </span>
                        ) : (
                          <Checkbox
                            checked={selection.has(student.id)}
                            disabled={closed}
                            aria-label={`Блюдо для ${student.last_name}`}
                            onCheckedChange={(value) => toggleStudent(student.id, value === true)}
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}

      {activeDay && items.length === 0 && !itemsQuery.isPending ? (
        <EmptyState
          title="Блюдо на цей день ще не складено"
          hint="Зверніться до працівника їдальні."
        />
      ) : null}

      {selection.size > 0 && !closed ? (
        <div className="sticky bottom-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-sm">
          <p className="text-sm">
            Обрано: <strong>{selection.size}</strong> {chosenCountLabel}
          </p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setSelection(new Set())}>
              Зняти вибір
            </Button>
            <Button onClick={() => setConfirmOpen(true)}>Замовити</Button>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Замовити блюдо для ${selection.size} ${chosenCountLabel}?`}
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
