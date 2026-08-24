import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { costRows } from '@/api/stats'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { qk } from '@/lib/queryKeys'
import { formatMonthValue, monthValueBounds, toMonthValue } from '@/lib/dates'
import { formatMoney, plural } from '@/lib/format'
import { ReportFrame } from '@/components/common/ReportFrame'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface Row {
  class_id: string
  class_name: string
  privileged_portions: number
  privileged_cost: number
  regular_portions: number
  regular_cost: number
}

/**
 * Звіт про відшкодування: скільки порцій видано і на яку суму, окремо
 * пільговим і звичайним учням.
 *
 * Суми беруться зі зліпків price_at_order — саме тих цін, що діяли на
 * момент замовлення, а не поточних із довідника.
 */
export default function ReimbursementReport() {
  const [month, setMonth] = useState(toMonthValue())
  const [from, to] = monthValueBounds(month)

  const costQuery = useQuery({
    queryKey: qk.costRows(from, to),
    queryFn: () => costRows(from, to),
    placeholderData: (previous) => previous,
  })

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const classesQuery = useQuery({
    queryKey: qk.classes(settingsQuery.data?.current_year),
    queryFn: () => listClasses(settingsQuery.data!.current_year),
    enabled: Boolean(settingsQuery.data),
  })

  const { rows, missingPrices } = useMemo(() => {
    const map = new Map<string, Row>()
    let missing = 0

    for (const order of costQuery.data ?? []) {
      const current = map.get(order.class_id) ?? {
        class_id: order.class_id,
        class_name:
          (classesQuery.data ?? []).find((item) => item.id === order.class_id)?.name ?? '—',
        privileged_portions: 0,
        privileged_cost: 0,
        regular_portions: 0,
        regular_cost: 0,
      }

      if (order.privileged) {
        current.privileged_portions += 1
        current.privileged_cost += order.cost
      } else {
        current.regular_portions += 1
        current.regular_cost += order.cost
      }
      missing += order.missing_prices
      map.set(order.class_id, current)
    }

    return {
      rows: [...map.values()].sort((a, b) => a.class_name.localeCompare(b.class_name, 'uk')),
      missingPrices: missing,
    }
  }, [costQuery.data, classesQuery.data])

  const totals = rows.reduce(
    (acc, row) => ({
      privileged_portions: acc.privileged_portions + row.privileged_portions,
      privileged_cost: acc.privileged_cost + row.privileged_cost,
      regular_portions: acc.regular_portions + row.regular_portions,
      regular_cost: acc.regular_cost + row.regular_cost,
    }),
    { privileged_portions: 0, privileged_cost: 0, regular_portions: 0, regular_cost: 0 },
  )

  return (
    <ReportFrame
      title="Звіт про відшкодування"
      description="Порції та їхня собівартість за місяць, окремо пільгові й звичайні."
      periodLabel={formatMonthValue(month)}
      params={
        <div className="space-y-2">
          <Label htmlFor="reimb-month">Місяць</Label>
          <Input
            id="reimb-month"
            type="month"
            className="w-44"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </div>
      }
      actions={
        <ExportButton
          rows={rows}
          filename={`відшкодування-${month}.csv`}
          columns={[
            { header: 'Клас', value: (r) => r.class_name },
            { header: 'Порцій пільгових', value: (r) => r.privileged_portions },
            { header: 'Сума пільгових, ₴', value: (r) => r.privileged_cost.toFixed(2) },
            { header: 'Порцій звичайних', value: (r) => r.regular_portions },
            { header: 'Сума звичайних, ₴', value: (r) => r.regular_cost.toFixed(2) },
            {
              header: 'Разом, ₴',
              value: (r) => (r.privileged_cost + r.regular_cost).toFixed(2),
            },
          ]}
        />
      }
    >
      {costQuery.isPending ? <LoadingState /> : null}
      {costQuery.error ? <ErrorState error={costQuery.error} /> : null}

      {missingPrices > 0 ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>Сума неповна</AlertTitle>
          <AlertDescription>
            У замовленнях цього місяця є {missingPrices}{' '}
            {plural(missingPrices, 'позиція', 'позиції', 'позицій')} без ціни — вони додають
            до суми нуль. Проставте ціни в довіднику страв і повторіть звіт, інакше відшкодування
            буде занижене.
          </AlertDescription>
        </Alert>
      ) : null}

      {!costQuery.isPending && rows.length === 0 ? (
        <EmptyState
          title="За цей місяць замовлень немає"
          hint="Оберіть інший місяць."
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клас</TableHead>
                <TableHead className="text-right">Порцій пільгових</TableHead>
                <TableHead className="text-right">Сума пільгових</TableHead>
                <TableHead className="text-right">Порцій звичайних</TableHead>
                <TableHead className="text-right">Сума звичайних</TableHead>
                <TableHead className="text-right">Разом</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.class_id}>
                  <TableCell className="font-medium">{row.class_name}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.privileged_portions}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.privileged_cost)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.regular_portions}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatMoney(row.regular_cost)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatMoney(row.privileged_cost + row.regular_cost)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Разом по школі</TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.privileged_portions}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(totals.privileged_cost)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {totals.regular_portions}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(totals.regular_cost)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatMoney(totals.privileged_cost + totals.regular_cost)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      ) : null}
    </ReportFrame>
  )
}
