import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck, Clock, Search, Star } from 'lucide-react'
import { toast } from 'sonner'
import { getSettings } from '@/api/settings'
import { listClasses } from '@/api/classes'
import { listStudentsOfClass } from '@/api/students'
import { areOrdersOpen, listMenuDays, listMenuItemsPlain } from '@/api/menu'
import { listOrdersPlainOfClass, placeOrder } from '@/api/orders'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { shiftIso } from '@/lib/dates'
import {
  MENU_STATUS_LABELS,
  formatCutoff,
  formatDateWithWeekday,
  fullName,
  toIsoDate,
} from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Student } from '@/types/database'

const DAYS_AHEAD = 30

/**
 * Дозамовлення: адміністрація замовляє за учня, коли керівник не встиг.
 *
 * Шлях «клас → учень» замість пошуку за прізвищем: дозамовляють зазвичай
 * за дзвінком «у 7-А ще двоє прийшли», і прізвище тут не перше, що відомо.
 * Після дедлайну замовлення приймається, але сервер сам позначає його
 * пізнім — воно окремо видно в аркуші кухні й у звітах.
 */
export default function ReorderPage() {
  const queryClient = useQueryClient()
  const today = toIsoDate()
  const [date, setDate] = useState<string | null>(null)
  const [classId, setClassId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [target, setTarget] = useState<Student | null>(null)

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const currentYear = settingsQuery.data?.current_year
  const classesQuery = useQuery({
    queryKey: qk.classes(currentYear),
    queryFn: () => listClasses(currentYear!),
    enabled: Boolean(currentYear),
  })

  const daysQuery = useQuery({
    queryKey: qk.menuDays(today, shiftIso(today, DAYS_AHEAD)),
    queryFn: () => listMenuDays(today, shiftIso(today, DAYS_AHEAD)),
  })
  const days = useMemo(() => daysQuery.data ?? [], [daysQuery.data])
  // Дозамовляють найчастіше на сьогодні — його й показуємо першим.
  const activeDate = date ?? days.find((day) => day.menu_date === today)?.menu_date ?? days[0]?.menu_date ?? null
  const activeDay = days.find((day) => day.menu_date === activeDate) ?? null

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

  const studentsQuery = useQuery({
    queryKey: qk.students(classId ?? ''),
    queryFn: () => listStudentsOfClass(classId!),
    enabled: Boolean(classId),
  })
  const ordersQuery = useQuery({
    queryKey: qk.ordersOfClass(classId ?? '', activeDate ?? ''),
    queryFn: () => listOrdersPlainOfClass(classId!, activeDate!),
    enabled: Boolean(classId && activeDate),
  })

  const orderOf = useMemo(
    () => new Map((ordersQuery.data ?? []).map((order) => [order.student_id, order])),
    [ordersQuery.data],
  )
  const dishNames = useMemo(
    () => (itemsQuery.data ?? []).map((item) => item.dishes.name).sort((a, b) => a.localeCompare(b, 'uk')),
    [itemsQuery.data],
  )
  const hasMenu = (itemsQuery.data ?? []).length > 0
  const willBeLate = openQuery.data === false

  const term = search.trim().toLocaleLowerCase('uk')
  const students = (studentsQuery.data ?? []).filter(
    (student) =>
      !term ||
      student.last_name.toLocaleLowerCase('uk').includes(term) ||
      student.first_name.toLocaleLowerCase('uk').includes(term),
  )

  const order = useMutation({
    // Блюдо неподільне: замовляється весь склад дня.
    mutationFn: (student: Student) =>
      placeOrder(student.id, activeDate!, (itemsQuery.data ?? []).map((item) => item.id)),
    onSuccess: async (_id, student) => {
      setTarget(null)
      toast.success(`Замовлено для ${fullName(student.last_name, student.first_name)}`)
      await queryClient.invalidateQueries({ queryKey: ['orders-of-class'] })
      await queryClient.invalidateQueries({ queryKey: ['orders-of-student'] })
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err) => {
      setTarget(null)
      toast.error(humanError(err))
    },
  })

  const error = settingsQuery.error ?? classesQuery.error ?? daysQuery.error ?? itemsQuery.error
  const classes = classesQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Дозамовити"
        description="Замовлення за учня, якщо керівник не встиг. Після дедлайну воно позначається як пізнє."
      />

      {error ? <ErrorState error={error} /> : null}
      {daysQuery.isLoading ? <LoadingState /> : null}

      {!daysQuery.isLoading && days.length === 0 ? (
        <EmptyState
          title="Немає днів меню на найближчий місяць"
          hint="Спершу створіть дні в «Редакторі меню»."
        />
      ) : null}

      {activeDate ? (
        <>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="reorder-day">День</Label>
              <Select value={activeDate} onValueChange={setDate}>
                <SelectTrigger id="reorder-day" className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((day) => (
                    <SelectItem key={day.menu_date} value={day.menu_date}>
                      {formatDateWithWeekday(day.menu_date)}
                      {day.status === 'published' ? '' : ` — ${MENU_STATUS_LABELS[day.status]}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reorder-class">Клас</Label>
              <Select value={classId ?? ''} onValueChange={(value) => { setClassId(value); setSearch('') }}>
                <SelectTrigger id="reorder-class" className="w-40">
                  <SelectValue placeholder="Оберіть клас" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((klass) => (
                    <SelectItem key={klass.id} value={klass.id}>
                      {klass.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {activeDay && !willBeLate ? (
              <p className="pb-2 text-sm text-muted-foreground">
                Прийом до {formatCutoff(activeDay.cutoff_at)}
              </p>
            ) : null}
          </div>

          <div className="space-y-1 rounded-lg border p-3">
            <p className="text-sm font-medium">Блюдо на цей день</p>
            {itemsQuery.isLoading ? <LoadingState /> : null}
            {!itemsQuery.isLoading ? (
              <p className="text-sm text-muted-foreground">
                {hasMenu ? dishNames.join(' · ') : 'Ще не складено — замовити не можна.'}
              </p>
            ) : null}
          </div>

          {willBeLate ? (
            <Alert>
              <Clock className="size-4" aria-hidden />
              <AlertTitle>Прийом замовлень на цей день уже закрито</AlertTitle>
              <AlertDescription>
                Дозамовити можна, але замовлення позначиться як пізнє — так його окремо видно
                в «Порціях на день» і в звітах.
              </AlertDescription>
            </Alert>
          ) : null}

          {!classId ? (
            <EmptyState title="Спершу оберіть клас" hint="Далі з’явиться список учнів, і біля кожного — кнопка «Дозамовити»." />
          ) : (
            <section className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="reorder-search">Пошук у класі</Label>
                <div className="relative max-w-sm">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                    aria-hidden
                  />
                  <Input
                    id="reorder-search"
                    className="pl-8"
                    placeholder="Прізвище або ім’я"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {studentsQuery.isLoading || ordersQuery.isLoading ? <LoadingState /> : null}
              {studentsQuery.error ? <ErrorState error={studentsQuery.error} /> : null}

              {studentsQuery.data && students.length === 0 ? (
                <EmptyState
                  title={studentsQuery.data.length === 0 ? 'У реєстрі класу нікого немає' : 'Нікого не знайдено'}
                />
              ) : null}

              {students.length > 0 && !ordersQuery.isLoading ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Учень</TableHead>
                        <TableHead className="w-48">На цей день</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {students.map((student) => {
                        const name = fullName(student.last_name, student.first_name)
                        const existing = orderOf.get(student.id)
                        return (
                          <TableRow key={student.id}>
                            <TableCell className="font-medium">
                              {name}
                              {student.is_privileged ? (
                                <Badge variant="secondary" className="ml-2">
                                  <Star className="size-3" aria-hidden />
                                  Пільга
                                </Badge>
                              ) : null}
                            </TableCell>
                            <TableCell>
                              {existing ? (
                                <span className="inline-flex items-center gap-1.5 text-sm">
                                  <CircleCheck className="size-4 text-primary" aria-hidden />
                                  Замовлено
                                  {existing.after_cutoff ? <Badge variant="secondary">пізнє</Badge> : null}
                                </span>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={!hasMenu || order.isPending}
                                  aria-label={`Дозамовити для ${name}`}
                                  onClick={() => setTarget(student)}
                                >
                                  Дозамовити
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : null}
            </section>
          )}
        </>
      ) : null}

      {target && activeDate ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setTarget(null)}
          title={`Дозамовити для ${fullName(target.last_name, target.first_name)}?`}
          description={
            <div className="space-y-2">
              <p>
                На {formatDateWithWeekday(activeDate)}: {dishNames.join(', ')}.
              </p>
              {willBeLate ? <p>Прийом уже закрито — замовлення позначиться як пізнє.</p> : null}
              <p>Скасувати замовлення можна в картці учня («Пошук учня» → «Замовлення»).</p>
            </div>
          }
          confirmLabel="Дозамовити"
          busy={order.isPending}
          onConfirm={() => order.mutate(target)}
        />
      ) : null}
    </div>
  )
}
