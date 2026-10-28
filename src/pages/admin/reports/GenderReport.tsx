import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { mealOrders } from '@/api/reports'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { buildGenderBreakdown, type GenderCounts } from '@/lib/mealReport'
import { qk } from '@/lib/queryKeys'
import { formatMonthValue, monthValueBounds, toMonthValue } from '@/lib/dates'
import { plural } from '@/lib/format'
import { ReportFrame } from '@/components/common/ReportFrame'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert, AlertDescription } from '@/components/ui/alert'
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
 * Скільки хлопців і дівчат харчувалося за місяць — по школі, ланках
 * (1–4, 5–9, 10–11) і класах. Рахуються діти, а не замовлення: хто поїв
 * хоча б один день місяця.
 */
export default function GenderReport() {
  const [month, setMonth] = useState(toMonthValue())
  const [from, to] = monthValueBounds(month)

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const classesQuery = useQuery({ queryKey: qk.classes(), queryFn: () => listClasses() })
  const ordersQuery = useQuery({
    queryKey: qk.mealOrders(from, to),
    queryFn: () => mealOrders(from, to),
    placeholderData: (previous) => previous,
  })

  const breakdown = useMemo(
    () =>
      buildGenderBreakdown(ordersQuery.data ?? [], classesQuery.data ?? [], {
        currentYear: settingsQuery.data?.current_year ?? '',
      }),
    [ordersQuery.data, classesQuery.data, settingsQuery.data],
  )

  const error = ordersQuery.error ?? classesQuery.error ?? settingsQuery.error
  const loading = ordersQuery.isLoading || classesQuery.isLoading || settingsQuery.isLoading
  const empty = !loading && (ordersQuery.data ?? []).length === 0

  return (
    <ReportFrame
      title="Харчування за статтю"
      description="Скільки хлопців і дівчат харчувалося — по школі, ланках і класах."
      periodLabel={formatMonthValue(month)}
      params={
        <div className="space-y-2">
          <Label htmlFor="gender-month">Місяць</Label>
          <Input
            id="gender-month"
            type="month"
            className="w-44"
            value={month}
            onChange={(e) => e.target.value && setMonth(e.target.value)}
          />
        </div>
      }
      actions={
        <ExportButton
          rows={breakdown.classes}
          filename={`стать-${month}.csv`}
          columns={[
            { header: 'Клас', value: (r) => r.name },
            { header: 'Хлопців', value: (r) => r.counts.male },
            { header: 'Дівчат', value: (r) => r.counts.female },
            { header: 'Стать не вказано', value: (r) => r.counts.unknown },
            { header: 'Разом', value: (r) => r.counts.total },
          ]}
        />
      }
    >
      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}

      {empty ? (
        <EmptyState title="За цей місяць замовлень немає" hint="Оберіть інший місяць." />
      ) : null}

      {!empty && breakdown.total.unknown > 0 ? (
        <Alert>
          <AlertDescription>
            У {breakdown.total.unknown}{' '}
            {plural(breakdown.total.unknown, 'дитини', 'дітей', 'дітей')} стать не вказано — їх
            видно в окремій колонці. Стать указується в картці учня.
          </AlertDescription>
        </Alert>
      ) : null}

      {!empty && !loading ? (
        <>
          <section className="space-y-2">
            <h2 className="text-sm font-medium">За ланками</h2>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <CountsHeader first="Ланка" />
                <TableBody>
                  {breakdown.levels.map((level) => (
                    <TableRow key={level.level}>
                      <TableCell className="font-medium">
                        {level.label}{' '}
                        <span className="text-muted-foreground">({level.grades})</span>
                      </TableCell>
                      <CountsCells counts={level.counts} />
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell>Усього по школі</TableCell>
                    <CountsCells counts={breakdown.total} />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-sm font-medium">По класах</h2>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <CountsHeader first="Клас" />
                <TableBody>
                  {breakdown.classes.map((row) => (
                    <TableRow key={row.classId}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <CountsCells counts={row.counts} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </section>
        </>
      ) : null}
    </ReportFrame>
  )
}

function CountsHeader({ first }: { first: string }) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead>{first}</TableHead>
        <TableHead className="text-right">Хлопців</TableHead>
        <TableHead className="text-right">Дівчат</TableHead>
        <TableHead className="text-right">Стать не вказано</TableHead>
        <TableHead className="text-right">Разом</TableHead>
      </TableRow>
    </TableHeader>
  )
}

function CountsCells({ counts }: { counts: GenderCounts }) {
  return (
    <>
      <TableCell className="text-right tabular-nums">{counts.male}</TableCell>
      <TableCell className="text-right tabular-nums">{counts.female}</TableCell>
      <TableCell className="text-right tabular-nums text-muted-foreground">{counts.unknown}</TableCell>
      <TableCell className="text-right font-medium tabular-nums">{counts.total}</TableCell>
    </>
  )
}
