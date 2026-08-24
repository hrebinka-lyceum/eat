import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { timesheetOrders } from '@/api/reports'
import { listMenuDays } from '@/api/menu'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { studentMonths } from '@/api/stats'
import { useAuth } from '@/auth/AuthContext'
import { useCanSeeCost } from '@/auth/permissions'
import { useMyClass } from '@/hooks/useMyClass'
import { qk } from '@/lib/queryKeys'
import { formatMonthValue, monthValueBounds, toMonthValue } from '@/lib/dates'
import { formatMoney, fullName } from '@/lib/format'
import { ReportFrame } from '@/components/common/ReportFrame'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
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

interface Row {
  student_id: string
  name: string
  days: Set<string>
  privileged: number
  late: number
  cost: number | null
}

/**
 * Табель харчування: сітка «учень × дні місяця».
 *
 * Колонки — лише ті дні, що є в menu_days: у місяці 30 чисел, а навчальних
 * днів двадцять, і порожні стовпці за вихідні тільки з'їдають ширину аркуша.
 */
export default function TimesheetReport() {
  const { role } = useAuth()
  const canSeeCost = useCanSeeCost()
  const isTeacher = role === 'teacher'
  const { myClass } = useMyClass()

  const [month, setMonth] = useState(toMonthValue())
  const [classId, setClassId] = useState<string | null>(null)
  const [from, to] = monthValueBounds(month)

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const classesQuery = useQuery({
    queryKey: qk.classes(settingsQuery.data?.current_year),
    queryFn: () => listClasses(settingsQuery.data!.current_year),
    enabled: Boolean(settingsQuery.data) && !isTeacher,
  })

  const activeClassId = isTeacher
    ? (myClass?.id ?? null)
    : (classId ?? classesQuery.data?.[0]?.id ?? null)

  const activeClassName = isTeacher
    ? (myClass?.name ?? '')
    : ((classesQuery.data ?? []).find((item) => item.id === activeClassId)?.name ?? '')

  const daysQuery = useQuery({
    queryKey: qk.menuDays(from, to),
    queryFn: () => listMenuDays(from, to),
  })

  const ordersQuery = useQuery({
    queryKey: ['timesheet', activeClassId, from, to],
    queryFn: () => timesheetOrders(activeClassId!, from, to),
    enabled: Boolean(activeClassId),
    placeholderData: (previous) => previous,
  })

  // Суми беремо з представлення: воно саме віддає null тим, кому вартість
  // не належить, тож підмішати гроші в табель керівника неможливо.
  const monthQuery = useQuery({
    queryKey: ['student-month', from, activeClassId],
    queryFn: () => studentMonths(from, activeClassId!),
    enabled: Boolean(activeClassId) && canSeeCost,
  })

  const days = useMemo(
    () => (daysQuery.data ?? []).map((day) => day.menu_date),
    [daysQuery.data],
  )

  const rows = useMemo(() => {
    const map = new Map<string, Row>()
    const costByStudent = new Map(
      (monthQuery.data ?? []).map((item) => [item.student_id, item.total_cost]),
    )

    for (const order of ordersQuery.data ?? []) {
      const current = map.get(order.student_id) ?? {
        student_id: order.student_id,
        name: order.students
          ? fullName(order.students.last_name, order.students.first_name)
          : 'учень з іншого класу',
        days: new Set<string>(),
        privileged: 0,
        late: 0,
        cost: costByStudent.get(order.student_id) ?? null,
      }
      current.days.add(order.menu_date)
      if (order.privileged_at_order) current.privileged += 1
      if (order.after_cutoff) current.late += 1
      map.set(order.student_id, current)
    }

    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, 'uk'))
  }, [ordersQuery.data, monthQuery.data])

  const loading = daysQuery.isPending || (Boolean(activeClassId) && ordersQuery.isPending)

  return (
    <ReportFrame
      title="Табель харчування"
      description="Хто якими днями харчувався. Дні беруться з меню, вихідні не показуються."
      periodLabel={`${activeClassName ? `клас ${activeClassName}, ` : ''}${formatMonthValue(month)}`}
      landscape
      params={
        <>
          <div className="space-y-2">
            <Label htmlFor="timesheet-month">Місяць</Label>
            <Input
              id="timesheet-month"
              type="month"
              className="w-44"
              value={month}
              onChange={(e) => e.target.value && setMonth(e.target.value)}
            />
          </div>

          {!isTeacher ? (
            <div className="space-y-2">
              <Label htmlFor="timesheet-class">Клас</Label>
              <Select value={activeClassId ?? undefined} onValueChange={setClassId}>
                <SelectTrigger id="timesheet-class" className="w-40">
                  <SelectValue placeholder="Оберіть клас" />
                </SelectTrigger>
                <SelectContent>
                  {(classesQuery.data ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
        </>
      }
      actions={
        <ExportButton
          rows={rows}
          filename={`табель-${activeClassName || 'клас'}-${month}.csv`}
          columns={[
            { header: 'Учень', value: (r) => r.name },
            ...days.map((day) => ({
              header: day.slice(8, 10),
              value: (r: Row) => (r.days.has(day) ? '+' : ''),
            })),
            { header: 'Днів усього', value: (r) => r.days.size },
            { header: 'З них пільгових', value: (r) => r.privileged },
            { header: 'З них пізніх', value: (r) => r.late },
            ...(canSeeCost ? [{ header: 'Сума, ₴', value: (r: Row) => r.cost ?? '' }] : []),
          ]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {ordersQuery.error ? <ErrorState error={ordersQuery.error} /> : null}

      {isTeacher && !myClass ? (
        <EmptyState
          title="За вами не закріплено клас"
          hint="Зверніться до адміністрації."
        />
      ) : null}

      {!loading && activeClassId && rows.length === 0 ? (
        <EmptyState
          title="За цей місяць замовлень у класі немає"
          hint="Оберіть інший місяць."
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-44">Учень</TableHead>
                {days.map((day) => (
                  <TableHead key={day} className="w-8 px-1 text-center tabular-nums">
                    {day.slice(8, 10)}
                  </TableHead>
                ))}
                <TableHead className="text-right">Днів</TableHead>
                <TableHead className="text-right">Пільг.</TableHead>
                <TableHead className="text-right">Пізніх</TableHead>
                {canSeeCost ? <TableHead className="text-right">Сума</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.student_id}>
                  <TableCell className="font-medium">{row.name}</TableCell>
                  {days.map((day) => (
                    <TableCell key={day} className="px-1 text-center">
                      {row.days.has(day) ? '+' : ''}
                    </TableCell>
                  ))}
                  <TableCell className="text-right font-medium tabular-nums">
                    {row.days.size}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.privileged || ''}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {row.late || ''}
                  </TableCell>
                  {canSeeCost ? (
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(row.cost)}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </ReportFrame>
  )
}
