import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { classCoverage, costRows, dailyTotals, ordersByDish } from '@/api/stats'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { useCanSeeCost } from '@/auth/permissions'
import { qk } from '@/lib/queryKeys'
import { monthBounds } from '@/lib/dates'
import {
  CATEGORY_LABELS,
  formatDate,
  formatDateWithWeekday,
  formatMoney,
  formatPercent,
  toIsoDate,
} from '@/lib/format'
import { csvFilename } from '@/lib/csv'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { StatTile } from '@/components/charts/StatTile'
import { ChartCard } from '@/components/charts/ChartCard'
import { OrdersByDayChart } from '@/components/charts/OrdersByDayChart'
import { CostByDayChart } from '@/components/charts/CostByDayChart'
import { CoverageByClassChart } from '@/components/charts/CoverageByClassChart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export default function SchoolDashboardPage() {
  const canSeeCost = useCanSeeCost()
  const [defaultFrom, defaultTo] = monthBounds(toIsoDate())
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [coverageDay, setCoverageDay] = useState<string | null>(null)

  // placeholderData: при зміні періоду екран не блимає скелетом,
  // а тримає попередні дані, поки не приїдуть нові.
  const totalsQuery = useQuery({
    queryKey: qk.dailyTotals(from, to),
    queryFn: () => dailyTotals(from, to),
    placeholderData: (previous) => previous,
  })

  const costQuery = useQuery({
    queryKey: qk.costRows(from, to),
    queryFn: () => costRows(from, to),
    enabled: canSeeCost,
    placeholderData: (previous) => previous,
  })

  const dishesQuery = useQuery({
    queryKey: qk.ordersByDish(from, to),
    queryFn: () => ordersByDish(from, to),
    placeholderData: (previous) => previous,
  })

  const days = totalsQuery.data ?? []
  const activeCoverageDay = coverageDay ?? days[days.length - 1]?.menu_date ?? null

  const coverageQuery = useQuery({
    queryKey: qk.classCoverage(activeCoverageDay ?? '', activeCoverageDay ?? ''),
    queryFn: () => classCoverage(activeCoverageDay!),
    enabled: Boolean(activeCoverageDay),
  })

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const classesQuery = useQuery({
    queryKey: qk.classes(settingsQuery.data?.current_year),
    queryFn: () => listClasses(settingsQuery.data!.current_year),
    enabled: Boolean(settingsQuery.data),
  })

  const ordersByDayData = useMemo(
    () =>
      days.map((day) => ({
        menu_date: day.menu_date,
        privileged: day.orders_privileged,
        regular: day.orders_regular,
      })),
    [days],
  )

  const costByDayData = useMemo(
    () =>
      days
        .filter((day) => day.total_cost !== null)
        .map((day) => ({ menu_date: day.menu_date, cost: day.total_cost as number })),
    [days],
  )

  // Розріз «пільгові / звичайні» за сумою — головна цифра для звіту про
  // відшкодування. Представлення ділять за ознакою лише кількість, тож
  // суму рахуємо зі зліпків цін у замовленнях.
  const costSplit = useMemo(() => {
    let privileged = 0
    let regular = 0
    for (const row of costQuery.data ?? []) {
      if (row.privileged) privileged += row.cost
      else regular += row.cost
    }
    return { privileged, regular, total: privileged + regular }
  }, [costQuery.data])

  const totals = useMemo(() => {
    return days.reduce(
      (acc, day) => ({
        orders: acc.orders + day.orders_total,
        privileged: acc.privileged + day.orders_privileged,
        regular: acc.regular + day.orders_regular,
        late: acc.late + day.orders_late,
      }),
      { orders: 0, privileged: 0, regular: 0, late: 0 },
    )
  }, [days])

  const dishTotals = useMemo(() => {
    const map = new Map<
      string,
      { name: string; category: string; portions: number; privileged: number; late: number; cost: number | null }
    >()
    for (const row of dishesQuery.data ?? []) {
      const current = map.get(row.dish_id) ?? {
        name: row.dish_name,
        category: row.category,
        portions: 0,
        privileged: 0,
        late: 0,
        cost: null as number | null,
      }
      current.portions += row.portions
      current.privileged += row.portions_privileged
      current.late += row.portions_late
      if (row.total_cost !== null) current.cost = (current.cost ?? 0) + row.total_cost
      map.set(row.dish_id, current)
    }
    return [...map.entries()]
      .map(([id, value]) => ({ id, ...value }))
      .sort((a, b) => b.portions - a.portions)
  }, [dishesQuery.data])

  const coverage = coverageQuery.data ?? []
  const classesWithoutSize = (classesQuery.data ?? []).filter((item) => item.total_students === null)

  const loading = totalsQuery.isPending || dishesQuery.isPending
  const error = totalsQuery.error ?? dishesQuery.error ?? costQuery.error

  return (
    <div className="space-y-6">
      <PageHeader
        title="Дашборд школи"
        description="Замовлення, охоплення й вартість за обраний період."
        actions={
          <ExportButton
            rows={days}
            filename={csvFilename('підсумки-по-днях')}
            columns={[
              { header: 'Дата', value: (d) => d.menu_date },
              { header: 'Замовлень', value: (d) => d.orders_total },
              { header: 'Пільгових', value: (d) => d.orders_privileged },
              { header: 'Звичайних', value: (d) => d.orders_regular },
              { header: 'Після дедлайну', value: (d) => d.orders_late },
              ...(canSeeCost
                ? [{ header: 'Вартість, ₴', value: (d: (typeof days)[number]) => d.total_cost ?? '' }]
                : []),
            ]}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="period-from">З дати</Label>
          <Input
            id="period-from"
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="period-to">По дату</Label>
          <Input
            id="period-to"
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
            const [start, end] = monthBounds(toIsoDate())
            setFrom(start)
            setTo(end)
            setCoverageDay(null)
          }}
        >
          Цей місяць
        </Button>

        {days.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="coverage-day">Охоплення на день</Label>
            <Select
              value={activeCoverageDay ?? undefined}
              onValueChange={(value) => setCoverageDay(value)}
            >
              <SelectTrigger id="coverage-day" className="w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {days.map((day) => (
                  <SelectItem key={day.menu_date} value={day.menu_date}>
                    {formatDateWithWeekday(day.menu_date)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}
      </div>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}

      {!loading && !error && days.length === 0 ? (
        <EmptyState
          title="За цей період замовлень немає"
          hint="Спробуйте інший період — наприклад, поточний місяць."
        />
      ) : null}

      {!loading && !error && days.length > 0 ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile
              label="Замовлень за період"
              value={totals.orders}
              hint={`${days.length} ${days.length === 1 ? 'день' : 'днів'} із замовленнями`}
              emphasis
            />
            <StatTile
              label="Пільгові / звичайні"
              value={`${totals.privileged} / ${totals.regular}`}
              hint="кількість замовлень"
            />
            {canSeeCost ? (
              <>
                <StatTile
                  label="Вартість за період"
                  value={formatMoney(costSplit.total)}
                  hint="собівартість порцій"
                />
                <StatTile
                  label="З них пільгових"
                  value={formatMoney(costSplit.privileged)}
                  hint={`звичайних ${formatMoney(costSplit.regular)}`}
                />
              </>
            ) : (
              <StatTile label="Після дедлайну" value={totals.late} hint="пізні замовлення" />
            )}
          </div>

          <ChartCard
            title="Замовлення по днях"
            description="Стовпчик — усі замовлення дня, поділені на пільгові та звичайні."
          >
            <OrdersByDayChart data={ordersByDayData} />
          </ChartCard>

          {canSeeCost && costByDayData.length > 0 ? (
            <ChartCard
              title="Вартість по днях"
              description="Собівартість виданих порцій, гривні."
            >
              <CostByDayChart data={costByDayData} />
            </ChartCard>
          ) : null}

          <ChartCard
            title="Охоплення по класах"
            description="Два різні відсотки: один показує пропуски, другий — потенціал."
            actions={
              <div className="flex items-center gap-2">
                <ExportButton
                  rows={coverage}
                  filename={csvFilename('охоплення', activeCoverageDay ?? undefined)}
                  columns={[
                    { header: 'Дата', value: (c) => c.menu_date },
                    { header: 'Клас', value: (c) => c.class_name },
                    { header: 'Замовили', value: (c) => c.students_ordered },
                    { header: 'У реєстрі харчування', value: (c) => c.students_registered },
                    { header: 'Усього в класі', value: (c) => c.total_students ?? '' },
                    {
                      header: 'Замовили, % від тих, хто харчується',
                      value: (c) => c.coverage_registered_pct ?? '',
                    },
                    {
                      header: 'Харчуються, % від усього класу',
                      value: (c) => c.coverage_class_pct ?? '',
                    },
                  ]}
                />
              </div>
            }
          >
            {coverage.length === 0 ? (
              <EmptyState title="Даних про охоплення на цей день немає" />
            ) : (
              <>
                <CoverageByClassChart
                  data={coverage.map((row) => ({
                    class_name: row.class_name,
                    registered_pct: row.coverage_registered_pct,
                    class_pct: row.coverage_class_pct,
                  }))}
                />
                <div className="mt-4 overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Клас</TableHead>
                        <TableHead className="text-right">Замовили</TableHead>
                        <TableHead className="text-right">У реєстрі харчування</TableHead>
                        <TableHead className="text-right">Усього в класі</TableHead>
                        <TableHead className="text-right">
                          Замовили, % від тих, хто харчується
                        </TableHead>
                        <TableHead className="text-right">
                          Харчуються, % від усього класу
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {coverage.map((row) => (
                        <TableRow key={row.class_id}>
                          <TableCell className="font-medium">{row.class_name}</TableCell>
                          <TableCell className="text-right tabular-nums">
                            {row.students_ordered}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.students_registered}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted-foreground">
                            {row.total_students ?? '—'}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(row.coverage_registered_pct)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatPercent(row.coverage_class_pct)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <dl className="mt-4 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="rounded-md border p-2">
                    <dt className="font-medium text-foreground">
                      Замовили цього дня — % від тих, хто харчується
                    </dt>
                    <dd>
                      Показує пропуски: скільки дітей із реєстру харчування насправді
                      замовили саме {formatDate(activeCoverageDay)}.
                    </dd>
                  </div>
                  <div className="rounded-md border p-2">
                    <dt className="font-medium text-foreground">
                      Харчуються — % від усього класу
                    </dt>
                    <dd>
                      Показує потенціал: яка частка класу взагалі їсть у школі. Рахується
                      лише там, де адміністрація вказала кількість учнів у класі.
                    </dd>
                  </div>
                </dl>

                {classesWithoutSize.length > 0 ? (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
                    <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <p>
                      Для класів {classesWithoutSize.map((item) => item.name).join(', ')} не
                      вказано кількість учнів, тому другий відсоток для них порожній.
                      Заповнити можна в розділі «Класи».
                    </p>
                  </div>
                ) : null}
              </>
            )}
          </ChartCard>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Страви за період</h2>
              <ExportButton
                rows={dishTotals}
                filename={csvFilename('страви-за-період')}
                columns={[
                  { header: 'Страва', value: (d) => d.name },
                  { header: 'Порцій', value: (d) => d.portions },
                  { header: 'З них пільгових', value: (d) => d.privileged },
                  { header: 'Після дедлайну', value: (d) => d.late },
                  ...(canSeeCost
                    ? [{ header: 'Вартість, ₴', value: (d: (typeof dishTotals)[number]) => d.cost ?? '' }]
                    : []),
                ]}
              />
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Страва</TableHead>
                    <TableHead>Категорія</TableHead>
                    <TableHead className="text-right">Порцій</TableHead>
                    <TableHead className="text-right">З них пільгових</TableHead>
                    {canSeeCost ? <TableHead className="text-right">Вартість</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dishTotals.map((dish) => (
                    <TableRow key={dish.id}>
                      <TableCell className="font-medium">{dish.name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {CATEGORY_LABELS[dish.category as keyof typeof CATEGORY_LABELS]}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{dish.portions}</TableCell>
                      <TableCell className="text-right tabular-nums">{dish.privileged}</TableCell>
                      {canSeeCost ? (
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(dish.cost)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>Разом</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dishTotals.reduce((sum, dish) => sum + dish.portions, 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dishTotals.reduce((sum, dish) => sum + dish.privileged, 0)}
                    </TableCell>
                    {canSeeCost ? (
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(costSplit.total)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>

          {!canSeeCost ? (
            <p className="text-xs text-muted-foreground">
              Вартість у цій ролі не показується: сервер не віддає її взагалі.
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
