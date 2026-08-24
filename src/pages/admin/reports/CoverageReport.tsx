import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { classCoverage } from '@/api/stats'
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

interface Row {
  class_id: string
  class_name: string
  total_students: number | null
  registered: number
  ordered_sum: number
  registered_sum: number
  days: number
}

/**
 * Охоплення за місяць. Два відсотки рахуються по-різному й навмисно:
 * перший — частка тих, хто справді замовляв, від тих, хто харчується;
 * другий — частка класу, яка взагалі харчується.
 */
export default function CoverageReport() {
  const [month, setMonth] = useState(toMonthValue())
  const [from, to] = monthValueBounds(month)

  const coverageQuery = useQuery({
    queryKey: qk.classCoverage(from, to),
    queryFn: () => classCoverage(from, to),
    placeholderData: (previous) => previous,
  })

  const rows = useMemo(() => {
    const map = new Map<string, Row>()

    for (const day of coverageQuery.data ?? []) {
      const current = map.get(day.class_id) ?? {
        class_id: day.class_id,
        class_name: day.class_name,
        total_students: day.total_students,
        registered: day.students_registered,
        ordered_sum: 0,
        registered_sum: 0,
        days: 0,
      }
      current.ordered_sum += day.students_ordered
      current.registered_sum += day.students_registered
      current.days += 1
      // Скільки в реєстрі — беремо за останній день періоду: це найсвіжіше
      // число, а не середнє по місяцю.
      current.registered = day.students_registered
      current.total_students = day.total_students
      map.set(day.class_id, current)
    }

    return [...map.values()].sort((a, b) => a.class_name.localeCompare(b.class_name, 'uk'))
  }, [coverageQuery.data])

  // Відсоток рахується від сум, а не як середнє з денних відсотків: інакше
  // день, коли в класі був один учень, важив би стільки ж, скільки повний.
  const registeredPct = (row: Row) =>
    row.registered_sum === 0 ? null : (row.ordered_sum / row.registered_sum) * 100

  const classPct = (row: Row) =>
    row.total_students ? (row.registered / row.total_students) * 100 : null

  const averagePerDay = (row: Row) => (row.days === 0 ? 0 : row.ordered_sum / row.days)

  const totals = rows.reduce(
    (acc, row) => ({
      total_students: acc.total_students + (row.total_students ?? 0),
      registered: acc.registered + row.registered,
      ordered_sum: acc.ordered_sum + row.ordered_sum,
      registered_sum: acc.registered_sum + row.registered_sum,
      days: Math.max(acc.days, row.days),
      // Клас без указаного розміру не можна брати лише в чисельник:
      // тоді школа «харчується» на 118%. Рахуємо його з обох боків або ніяк.
      sized_total: acc.sized_total + (row.total_students ?? 0),
      sized_registered: acc.sized_registered + (row.total_students ? row.registered : 0),
    }),
    {
      total_students: 0,
      registered: 0,
      ordered_sum: 0,
      registered_sum: 0,
      days: 0,
      sized_total: 0,
      sized_registered: 0,
    },
  )

  const unsized = rows.filter((row) => row.total_students === null)

  return (
    <ReportFrame
      title="Охоплення харчуванням"
      description="Скільки дітей харчується і як часто вони замовляють — по класах за місяць."
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
            { header: 'Клас', value: (r) => r.class_name },
            { header: 'Усього учнів у класі', value: (r) => r.total_students ?? '' },
            { header: 'У реєстрі харчування', value: (r) => r.registered },
            { header: 'У середньому замовляли на день', value: (r) => averagePerDay(r).toFixed(1) },
            {
              header: 'Замовили, % від тих, хто харчується',
              value: (r) => registeredPct(r)?.toFixed(1) ?? '',
            },
            {
              header: 'У реєстрі, % від усього класу',
              value: (r) => classPct(r)?.toFixed(1) ?? '',
            },
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
                  <TableHead className="text-right">Усього в класі</TableHead>
                  <TableHead className="text-right">У реєстрі харчування</TableHead>
                  <TableHead className="text-right">У середньому за день</TableHead>
                  <TableHead className="text-right">
                    Замовили, % від тих, хто харчується
                  </TableHead>
                  <TableHead className="text-right">У реєстрі, % від усього класу</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.class_id}>
                    <TableCell className="font-medium">{row.class_name}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.total_students ?? '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.registered}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {averagePerDay(row).toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(registeredPct(row))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatPercent(classPct(row))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Разом по школі</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {totals.total_students || '—'}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{totals.registered}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {(totals.days === 0 ? 0 : totals.ordered_sum / totals.days).toFixed(1)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(
                      totals.registered_sum === 0
                        ? null
                        : (totals.ordered_sum / totals.registered_sum) * 100,
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPercent(
                      totals.sized_total === 0
                        ? null
                        : (totals.sized_registered / totals.sized_total) * 100,
                    )}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {unsized.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              Підсумковий відсоток «у реєстрі від усього класу» порахований без класів{' '}
              {unsized.map((row) => row.class_name).join(', ')}: для них не вказано
              кількість учнів. Заповнити можна в розділі «Класи».
            </p>
          ) : null}

          <dl className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
            <div className="rounded-md border p-2">
              <dt className="font-medium text-foreground">
                Замовили, % від тих, хто харчується
              </dt>
              <dd>
                Показує пропуски. Рахується від сум за місяць, а не як середнє денних
                відсотків, — інакше день з одним присутнім важив би як повний.
              </dd>
            </div>
            <div className="rounded-md border p-2">
              <dt className="font-medium text-foreground">У реєстрі, % від усього класу</dt>
              <dd>
                Показує потенціал: яка частка класу взагалі харчується в школі. Порожньо
                там, де адміністрація не вказала кількість учнів. У підсумковому рядку такі
                класи не враховуються з обох боків дробу — інакше вийшло б понад 100%.
              </dd>
            </div>
          </dl>
        </>
      ) : null}
    </ReportFrame>
  )
}
