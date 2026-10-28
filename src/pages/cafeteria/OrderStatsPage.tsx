import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { classCoverage, dailyTotals, orderGenders } from '@/api/stats'
import { listMenuDays } from '@/api/menu'
import { useCanSeeCost } from '@/auth/permissions'
import { qk } from '@/lib/queryKeys'
import { shiftIso } from '@/lib/dates'
import { csvFilename } from '@/lib/csv'
import { formatDate, formatDateWithWeekday, formatMoney, toIsoDate } from '@/lib/format'
import { compareClassNames } from '@/lib/grades'
import { sumGender, tallyGender, type GenderCounts } from '@/lib/mealReport'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { StatTile } from '@/components/charts/StatTile'
import { ChartCard } from '@/components/charts/ChartCard'
import { OrdersByDayChart } from '@/components/charts/OrdersByDayChart'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

/** Скільки днів навколо сьогодні показувати за замовчуванням. */
const WINDOW = 7

interface DayRow {
  menu_date: string
  total: number
  privileged: number
  regular: number
  late: number
  cost: number | null
  /** День ще попереду — його цифра зростатиме до дедлайну */
  upcoming: boolean
}

/**
 * Проста статистика замовлень для їдальні: скільки порцій по днях і від
 * яких класів.
 *
 * Період навмисно захоплює майбутні дні: кухні треба не звітувати за минуле,
 * а знати, скільки готувати завтра. Дні, що ще попереду, позначені — їхні
 * числа неповні, поки не мине час прийому замовлень.
 */
export default function OrderStatsPage() {
  const canSeeCost = useCanSeeCost()
  const today = toIsoDate()
  const [from, setFrom] = useState(shiftIso(today, -WINDOW))
  const [to, setTo] = useState(shiftIso(today, WINDOW))

  const daysQuery = useQuery({
    queryKey: qk.menuDays(from, to),
    queryFn: () => listMenuDays(from, to),
    placeholderData: (previous) => previous,
  })

  const totalsQuery = useQuery({
    queryKey: qk.dailyTotals(from, to),
    queryFn: () => dailyTotals(from, to),
    placeholderData: (previous) => previous,
  })

  const coverageQuery = useQuery({
    queryKey: qk.classCoverage(from, to),
    queryFn: () => classCoverage(from, to),
    placeholderData: (previous) => previous,
  })

  const genderQuery = useQuery({
    queryKey: qk.orderGenders(from, to),
    queryFn: () => orderGenders(from, to),
    placeholderData: (previous) => previous,
  })

  // Кістяк — дні меню, а не дні із замовленнями: порожній завтрашній день
  // теж треба бачити, інакше здається, що його немає.
  const rows = useMemo<DayRow[]>(() => {
    const totals = new Map((totalsQuery.data ?? []).map((row) => [row.menu_date, row]))
    return (daysQuery.data ?? []).map((day) => {
      const found = totals.get(day.menu_date)
      return {
        menu_date: day.menu_date,
        total: found?.orders_total ?? 0,
        privileged: found?.orders_privileged ?? 0,
        regular: found?.orders_regular ?? 0,
        late: found?.orders_late ?? 0,
        cost: found?.total_cost ?? null,
        upcoming: day.menu_date > today,
      }
    })
  }, [daysQuery.data, totalsQuery.data, today])

  // Матриця «клас × день» — саме те, що потрібно, щоб знати, кому скільки везти.
  const { classes, byClass, dates } = useMemo(() => {
    const map = new Map<string, { name: string; days: Map<string, number>; total: number }>()
    for (const row of coverageQuery.data ?? []) {
      const current = map.get(row.class_id) ?? {
        name: row.class_name,
        days: new Map<string, number>(),
        total: 0,
      }
      current.days.set(row.menu_date, row.students_ordered)
      current.total += row.students_ordered
      map.set(row.class_id, current)
    }
    return {
      classes: [...map.entries()]
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => compareClassNames(a.name, b.name)),
      byClass: map,
      dates: rows.map((row) => row.menu_date),
    }
  }, [coverageQuery.data, rows])

  // Хлопці й дівчата: за день — замовлення (= діти), за клас за період — порції.
  const genderByDay = useMemo(
    () => tallyGender(genderQuery.data ?? [], (row) => row.menu_date),
    [genderQuery.data],
  )
  const genderByClass = useMemo(
    () => tallyGender(genderQuery.data ?? [], (row) => row.class_id),
    [genderQuery.data],
  )
  const periodGender = sumGender(genderByDay.values())
  const withUnknown = periodGender.unknown > 0
  const NO_GENDER: GenderCounts = { male: 0, female: 0, unknown: 0, total: 0 }
  const dayGender = (date: string) => genderByDay.get(date) ?? NO_GENDER
  const classGender = (classId: string) => genderByClass.get(classId) ?? NO_GENDER

  const total = rows.reduce((sum, row) => sum + row.total, 0)
  const daysWithOrders = rows.filter((row) => row.total > 0)
  const average = daysWithOrders.length === 0 ? 0 : total / daysWithOrders.length
  const busiest = rows.reduce<DayRow | null>(
    (best, row) => (best === null || row.total > best.total ? row : best),
    null,
  )
  const periodCost = rows.reduce((sum, row) => sum + (row.cost ?? 0), 0)

  const loading = daysQuery.isPending || totalsQuery.isPending
  const error = daysQuery.error ?? totalsQuery.error ?? coverageQuery.error ?? genderQuery.error

  return (
    <div className="space-y-6" data-print="sheet">
      <PageHeader
        title="Замовлення по днях"
        description="Скільки порцій, від яких класів, скільки хлопців і дівчат — разом із днями, що ще попереду."
        actions={
          <ExportButton
            rows={rows}
            filename={csvFilename('замовлення-по-днях')}
            columns={[
              { header: 'Дата', value: (r) => r.menu_date },
              { header: 'Замовлень', value: (r) => r.total },
              { header: 'Хлопців', value: (r) => dayGender(r.menu_date).male },
              { header: 'Дівчат', value: (r) => dayGender(r.menu_date).female },
              { header: 'Стать не вказано', value: (r) => dayGender(r.menu_date).unknown },
              { header: 'Пільгових', value: (r) => r.privileged },
              { header: 'Звичайних', value: (r) => r.regular },
              { header: 'Після дедлайну', value: (r) => r.late },
              { header: 'Ще попереду', value: (r) => r.upcoming },
              ...(canSeeCost
                ? [{ header: 'Вартість, ₴', value: (r: DayRow) => r.cost ?? '' }]
                : []),
            ]}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-3" data-print="hide">
        <div className="space-y-2">
          <Label htmlFor="stats-from">З дати</Label>
          <Input
            id="stats-from"
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="stats-to">По дату</Label>
          <Input
            id="stats-to"
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-1"
          onClick={() => {
            setFrom(shiftIso(today, -WINDOW))
            setTo(shiftIso(today, WINDOW))
          }}
        >
          Тиждень навколо сьогодні
        </Button>
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}

      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title="За цей період немає жодного дня меню"
          hint="Дні створює редактор меню — можливо, їх ще не згенерували."
        />
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Замовлень за період" value={total} emphasis />
            <StatTile
              label="У середньому за день"
              value={average.toFixed(average % 1 === 0 ? 0 : 1)}
              hint={`днів із замовленнями: ${daysWithOrders.length}`}
            />
            <StatTile
              label="Найбільший день"
              value={busiest && busiest.total > 0 ? busiest.total : '—'}
              hint={busiest && busiest.total > 0 ? formatDate(busiest.menu_date) : undefined}
            />
            {canSeeCost ? (
              <StatTile
                label="Вартість за період"
                value={formatMoney(periodCost)}
                hint="собівартість порцій"
              />
            ) : null}
          </div>

          <ChartCard
            title="Замовлення по днях"
            description="Стовпчик — усі замовлення дня, поділені на пільгові та звичайні."
          >
            <OrdersByDayChart
              data={rows.map((row) => ({
                menu_date: row.menu_date,
                privileged: row.privileged,
                regular: row.regular,
              }))}
            />
          </ChartCard>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>День</TableHead>
                  <TableHead className="text-right">Замовлень</TableHead>
                  <TableHead className="text-right">Хлопців</TableHead>
                  <TableHead className="text-right">Дівчат</TableHead>
                  {withUnknown ? <TableHead className="text-right">Стать не вказано</TableHead> : null}
                  <TableHead className="text-right">Пільгових</TableHead>
                  <TableHead className="text-right">Звичайних</TableHead>
                  <TableHead className="text-right">Після дедлайну</TableHead>
                  {canSeeCost ? <TableHead className="text-right">Вартість</TableHead> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.menu_date}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {formatDateWithWeekday(row.menu_date)}
                        {row.upcoming ? <Badge variant="secondary">попереду</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-base font-semibold tabular-nums">
                      {row.total}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{dayGender(row.menu_date).male}</TableCell>
                    <TableCell className="text-right tabular-nums">{dayGender(row.menu_date).female}</TableCell>
                    {withUnknown ? (
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {dayGender(row.menu_date).unknown || '—'}
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right tabular-nums">{row.privileged}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.regular}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.late || '—'}
                    </TableCell>
                    {canSeeCost ? (
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(row.cost)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Разом</TableCell>
                  <TableCell className="text-right tabular-nums">{total}</TableCell>
                  <TableCell className="text-right tabular-nums">{periodGender.male}</TableCell>
                  <TableCell className="text-right tabular-nums">{periodGender.female}</TableCell>
                  {withUnknown ? (
                    <TableCell className="text-right tabular-nums">{periodGender.unknown}</TableCell>
                  ) : null}
                  <TableCell className="text-right tabular-nums">
                    {rows.reduce((sum, row) => sum + row.privileged, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rows.reduce((sum, row) => sum + row.regular, 0)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {rows.reduce((sum, row) => sum + row.late, 0)}
                  </TableCell>
                  {canSeeCost ? (
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(periodCost)}
                    </TableCell>
                  ) : null}
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Класи по днях</h2>
              <div data-print="hide">
                <ExportButton
                  rows={classes}
                  filename={csvFilename('замовлення-по-класах')}
                  columns={[
                    { header: 'Клас', value: (c) => c.name },
                    ...dates.map((date) => ({
                      header: date,
                      value: (c: (typeof classes)[number]) => c.days.get(date) ?? 0,
                    })),
                    { header: 'Разом', value: (c) => c.total },
                    { header: 'Хлопців', value: (c) => classGender(c.id).male },
                    { header: 'Дівчат', value: (c) => classGender(c.id).female },
                    { header: 'Стать не вказано', value: (c) => classGender(c.id).unknown },
                  ]}
                />
              </div>
            </div>

            {classes.length === 0 ? (
              <EmptyState title="За цей період жоден клас нічого не замовляв" />
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-24">Клас</TableHead>
                      {dates.map((date) => (
                        <TableHead key={date} className="w-14 text-center tabular-nums">
                          {date.slice(8, 10)}.{date.slice(5, 7)}
                        </TableHead>
                      ))}
                      <TableHead className="text-right">Разом</TableHead>
                      <TableHead className="text-right">Хлопців</TableHead>
                      <TableHead className="text-right">Дівчат</TableHead>
                      {withUnknown ? <TableHead className="text-right">Стать не вказано</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        {dates.map((date) => {
                          const value = item.days.get(date) ?? 0
                          return (
                            <TableCell
                              key={date}
                              className={
                                value === 0
                                  ? 'text-center tabular-nums text-muted-foreground'
                                  : 'text-center tabular-nums'
                              }
                            >
                              {value === 0 ? '—' : value}
                            </TableCell>
                          )
                        })}
                        <TableCell className="text-right font-medium tabular-nums">
                          {item.total}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{classGender(item.id).male}</TableCell>
                        <TableCell className="text-right tabular-nums">{classGender(item.id).female}</TableCell>
                        {withUnknown ? (
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {classGender(item.id).unknown || '—'}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell>Разом</TableCell>
                      {dates.map((date) => (
                        <TableCell key={date} className="text-center tabular-nums">
                          {[...byClass.values()].reduce(
                            (sum, item) => sum + (item.days.get(date) ?? 0),
                            0,
                          )}
                        </TableCell>
                      ))}
                      <TableCell className="text-right tabular-nums">
                        {classes.reduce((sum, item) => sum + item.total, 0)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{periodGender.male}</TableCell>
                      <TableCell className="text-right tabular-nums">{periodGender.female}</TableCell>
                      {withUnknown ? (
                        <TableCell className="text-right tabular-nums">{periodGender.unknown}</TableCell>
                      ) : null}
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
