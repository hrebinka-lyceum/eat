import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import { classCoverage, costRows, dailyTotals, ordersByDish } from '@/api/stats'
import { useCanSeeCost } from '@/auth/permissions'
import { qk } from '@/lib/queryKeys'
import { CATEGORY_LABELS, CATEGORY_ORDER, formatDateWithWeekday, formatMoney, toIsoDate } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { StatTile } from '@/components/charts/StatTile'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DayPicker } from './components/DayPicker'

/**
 * Головний екран їдальні: скільки чого готувати цього дня.
 *
 * Вартість тут показується, бо екран доступний лише їдальні та
 * адміністрації. Але total_cost із представлень все одно може прийти
 * як null — тоді формат покаже риску, а не 0,00.
 */
export default function PortionsPage() {
  const [date, setDate] = useState(toIsoDate())
  const canSeeCost = useCanSeeCost()

  const dishesQuery = useQuery({
    queryKey: qk.ordersByDish(date, date),
    queryFn: () => ordersByDish(date),
    placeholderData: (previous) => previous,
  })

  const totalsQuery = useQuery({
    queryKey: qk.dailyTotals(date, date),
    queryFn: () => dailyTotals(date, date),
    placeholderData: (previous) => previous,
  })

  const coverageQuery = useQuery({
    queryKey: qk.classCoverage(date, date),
    queryFn: () => classCoverage(date),
    placeholderData: (previous) => previous,
  })

  const costQuery = useQuery({
    queryKey: qk.costRows(date, date),
    queryFn: () => costRows(date, date),
    enabled: canSeeCost,
  })

  const dishes = useMemo(
    () =>
      [...(dishesQuery.data ?? [])].sort((a, b) => {
        const byCategory = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
        return byCategory !== 0 ? byCategory : a.dish_name.localeCompare(b.dish_name, 'uk')
      }),
    [dishesQuery.data],
  )

  const totals = totalsQuery.data?.[0] ?? null

  const costByClass = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of costQuery.data ?? []) {
      map.set(row.class_id, (map.get(row.class_id) ?? 0) + row.cost)
    }
    return map
  }, [costQuery.data])

  const classes = useMemo(
    () =>
      [...(coverageQuery.data ?? [])]
        .filter((row) => row.students_ordered > 0)
        .sort((a, b) => a.class_name.localeCompare(b.class_name, 'uk')),
    [coverageQuery.data],
  )

  const portionsTotal = dishes.reduce((sum, dish) => sum + dish.portions, 0)
  const dayCost = dishes.reduce((sum, dish) => sum + (dish.total_cost ?? 0), 0)
  const anyCost = dishes.some((dish) => dish.total_cost !== null)

  const loading = dishesQuery.isPending || totalsQuery.isPending
  const error = dishesQuery.error ?? totalsQuery.error ?? coverageQuery.error

  return (
    <div className="space-y-6" data-print="sheet">
      <PageHeader
        title="Порції на день"
        description="Скільки чого готувати. Пільгові та пізні замовлення — окремими колонками."
        actions={
          <>
            <ExportButton
              rows={dishes}
              filename={`порції-${date}.csv`}
              columns={[
                { header: 'Дата', value: () => date },
                { header: 'Категорія', value: (d) => CATEGORY_LABELS[d.category] },
                { header: 'Страва', value: (d) => d.dish_name },
                { header: 'Порцій', value: (d) => d.portions },
                { header: 'З них пільгових', value: (d) => d.portions_privileged },
                { header: 'Після дедлайну', value: (d) => d.portions_late },
                ...(canSeeCost
                  ? [{ header: 'Вартість, ₴', value: (d: (typeof dishes)[number]) => d.total_cost ?? '' }]
                  : []),
              ]}
            />
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Друк
            </Button>
          </>
        }
      />

      <div data-print="hide">
        <DayPicker value={date} onChange={setDate} />
      </div>

      <p className="hidden text-sm font-medium print:block">
        {formatDateWithWeekday(date)}
      </p>

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}

      {!loading && !error ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatTile label="Порцій усього" value={portionsTotal} emphasis />
            <StatTile
              label="Замовлень"
              value={totals?.orders_total ?? 0}
              hint={
                totals
                  ? `пільгових ${totals.orders_privileged}, звичайних ${totals.orders_regular}`
                  : undefined
              }
            />
            <StatTile
              label="Після дедлайну"
              value={totals?.orders_late ?? 0}
              hint="додані адміністрацією пізніше"
            />
            {canSeeCost ? (
              <StatTile
                label="Вартість за день"
                value={formatMoney(anyCost ? dayCost : null)}
                hint="собівартість порцій"
              />
            ) : null}
          </div>

          {dishes.length === 0 ? (
            <EmptyState
              title="На цей день замовлень немає"
              hint="Оберіть інший день або перевірте, чи меню опубліковане."
            />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Страва</TableHead>
                    <TableHead>Категорія</TableHead>
                    <TableHead className="text-right">Порцій</TableHead>
                    <TableHead className="text-right">З них пільгових</TableHead>
                    <TableHead className="text-right">Після дедлайну</TableHead>
                    {canSeeCost ? <TableHead className="text-right">Вартість</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dishes.map((dish) => (
                    <TableRow key={dish.dish_id}>
                      <TableCell className="font-medium">{dish.dish_name}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {CATEGORY_LABELS[dish.category]}
                      </TableCell>
                      <TableCell className="text-right text-base font-semibold tabular-nums">
                        {dish.portions}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {dish.portions_privileged}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {dish.portions_late || '—'}
                      </TableCell>
                      {canSeeCost ? (
                        <TableCell className="text-right tabular-nums">
                          {formatMoney(dish.total_cost)}
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2}>Разом</TableCell>
                    <TableCell className="text-right tabular-nums">{portionsTotal}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dishes.reduce((sum, dish) => sum + dish.portions_privileged, 0)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {dishes.reduce((sum, dish) => sum + dish.portions_late, 0)}
                    </TableCell>
                    {canSeeCost ? (
                      <TableCell className="text-right tabular-nums">
                        {formatMoney(anyCost ? dayCost : null)}
                      </TableCell>
                    ) : null}
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          )}

          {classes.length > 0 ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-medium">Розбивка по класах</h2>
                <div data-print="hide">
                  <ExportButton
                    rows={classes}
                    filename={`порції-класи-${date}.csv`}
                    columns={[
                      { header: 'Дата', value: () => date },
                      { header: 'Клас', value: (c) => c.class_name },
                      { header: 'Замовили', value: (c) => c.students_ordered },
                      { header: 'У реєстрі', value: (c) => c.students_registered },
                      ...(canSeeCost
                        ? [
                            {
                              header: 'Вартість, ₴',
                              value: (c: (typeof classes)[number]) => costByClass.get(c.class_id) ?? '',
                            },
                          ]
                        : []),
                    ]}
                  />
                </div>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Клас</TableHead>
                      <TableHead className="text-right">Замовили</TableHead>
                      <TableHead className="text-right">У реєстрі</TableHead>
                      {canSeeCost ? <TableHead className="text-right">Вартість</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {classes.map((row) => (
                      <TableRow key={row.class_id}>
                        <TableCell className="font-medium">{row.class_name}</TableCell>
                        <TableCell className="text-right text-base font-semibold tabular-nums">
                          {row.students_ordered}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {row.students_registered}
                        </TableCell>
                        {canSeeCost ? (
                          <TableCell className="text-right tabular-nums">
                            {formatMoney(costByClass.get(row.class_id) ?? null)}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
