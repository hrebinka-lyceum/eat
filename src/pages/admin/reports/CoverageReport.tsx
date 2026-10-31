import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { classCoverage } from '@/api/stats'
import {
  aggregateCoverage,
  coverageAveragePerDay,
  coverageRegisteredPct,
  coverageTotalRegisteredPct,
  coverageTotals,
  type CoverageClass,
} from '@/lib/reportMath'
import { qk } from '@/lib/queryKeys'
import { formatMonthValue, monthValueBounds, toMonthValue } from '@/lib/dates'
import { formatPercent } from '@/lib/format'
import { ReportFrame } from '@/components/common/ReportFrame'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
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

/**
 * Охоплення за місяць: яка частка класу замовляла. Список класу — це всі
 * учні, тож «учнів у класі» береться зі списку, а не вписується окремо.
 */
export default function CoverageReport() {
  const [month, setMonth] = useState(toMonthValue())
  const [from, to] = monthValueBounds(month)

  const coverageQuery = useQuery({
    queryKey: qk.classCoverage(from, to),
    queryFn: () => classCoverage(from, to),
    placeholderData: (previous) => previous,
  })

  const rows = useMemo(() => aggregateCoverage(coverageQuery.data ?? []), [coverageQuery.data])

  const totals = coverageTotals(rows)

  return (
    <ReportFrame
      title="Охоплення харчуванням"
      description="Яка частка кожного класу замовляла харчування — за місяць."
      periodLabel={formatMonthValue(month)}
      params={
        <div className="space-y-2">
          <Label htmlFor="coverage-month">Місяць</Label>
          <Input
            id="coverage-month"
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
          filename={`охоплення-${month}.csv`}
          columns={[
            { header: 'Клас', value: (r: CoverageClass) => r.class_name },
            { header: 'Учнів у класі', value: (r) => r.registered },
            { header: 'У середньому замовляли на день', value: (r) => coverageAveragePerDay(r).toFixed(1) },
            { header: 'Охоплення, % від класу', value: (r) => coverageRegisteredPct(r)?.toFixed(1) ?? '' },
          ]}
        />
      }
    >
      {coverageQuery.isPending ? <LoadingState /> : null}
      {coverageQuery.error ? <ErrorState error={coverageQuery.error} /> : null}

      {!coverageQuery.isPending && rows.length === 0 ? (
        <EmptyState title="За цей місяць даних немає" hint="Оберіть інший місяць." />
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клас</TableHead>
                  <TableHead className="text-right">Учнів у класі</TableHead>
                  <TableHead className="text-right">У середньому замовляли за день</TableHead>
                  <TableHead className="text-right">Охоплення, % від класу</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.class_id}>
                    <TableCell className="font-medium">{row.class_name}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.registered}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {coverageAveragePerDay(row).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(coverageRegisteredPct(row))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Разом по школі</TableCell>
                  <TableCell className="text-right tabular-nums">{totals.registered}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(totals.days === 0 ? 0 : totals.ordered_sum / totals.days).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(coverageTotalRegisteredPct(totals))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          <p className="text-xs text-muted-foreground">
            Охоплення рахується від сум за місяць (усі замовлення ÷ усі учні класу в усі дні),
            а не як середнє денних відсотків, — інакше день з одним присутнім важив би як повний.
          </p>
        </>
      ) : null}
    </ReportFrame>
  )
}
