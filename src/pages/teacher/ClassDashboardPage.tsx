import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { classCoverage } from '@/api/stats'
import { listStudentsOfClass } from '@/api/students'
import { useMyClass } from '@/hooks/useMyClass'
import { qk } from '@/lib/queryKeys'
import { shiftIso } from '@/lib/dates'
import { csvFilename } from '@/lib/csv'
import { formatDate, formatPercent, toIsoDate } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { StatTile } from '@/components/charts/StatTile'
import { ChartCard } from '@/components/charts/ChartCard'
import { CoverageTrendChart } from '@/components/charts/CoverageTrendChart'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

const DEFAULT_DAYS = 30

/**
 * Дашборд класу. Жодних сум: у представленні v_class_coverage вартості
 * немає взагалі, тож показувати тут нічого й не було б.
 */
export default function ClassDashboardPage() {
  const { myClass, isPending: classPending, error: classError } = useMyClass()
  const today = toIsoDate()
  const [from, setFrom] = useState(shiftIso(today, -DEFAULT_DAYS))
  const [to, setTo] = useState(today)

  const coverageQuery = useQuery({
    queryKey: qk.classCoverage(from, to),
    queryFn: () => classCoverage(from, to),
    enabled: Boolean(myClass),
    placeholderData: (previous) => previous,
  })

  const studentsQuery = useQuery({
    queryKey: qk.students(myClass?.id ?? ''),
    queryFn: () => listStudentsOfClass(myClass!.id),
    enabled: Boolean(myClass),
  })

  // RLS віддає керівнику лише його клас, але фільтруємо явно —
  // так екран лишається правильним і для ролей, що бачать більше.
  const rows = useMemo(
    () =>
      (coverageQuery.data ?? [])
        .filter((row) => row.class_id === myClass?.id)
        .sort((a, b) => a.menu_date.localeCompare(b.menu_date)),
    [coverageQuery.data, myClass],
  )

  const last = rows[rows.length - 1] ?? null
  const registered = studentsQuery.data?.length ?? 0
  const averagePct = useMemo(() => {
    const values = rows
      .map((row) => row.coverage_registered_pct)
      .filter((value): value is number => value !== null)
    if (values.length === 0) return null
    return values.reduce((sum, value) => sum + value, 0) / values.length
  }, [rows])

  if (classPending) return <LoadingState />
  if (classError) return <ErrorState error={classError} />

  if (!myClass) {
    return (
      <div className="space-y-6">
        <PageHeader title="Дашборд класу" />
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
        title={`Дашборд класу ${myClass.name}`}
        description="Скільки дітей харчується і як часто вони замовляють."
        actions={
          <ExportButton
            rows={rows}
            filename={csvFilename(`охоплення-${myClass.name}`)}
            columns={[
              { header: 'Дата', value: (r) => r.menu_date },
              { header: 'Замовили', value: (r) => r.students_ordered },
              { header: 'У реєстрі харчування', value: (r) => r.students_registered },
              { header: 'Усього в класі', value: (r) => r.total_students ?? '' },
              {
                header: 'Замовили, % від тих, хто харчується',
                value: (r) => r.coverage_registered_pct ?? '',
              },
              {
                header: 'Харчуються, % від усього класу',
                value: (r) => r.coverage_class_pct ?? '',
              },
            ]}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-2">
          <Label htmlFor="class-from">З дати</Label>
          <Input
            id="class-from"
            type="date"
            className="w-40"
            value={from}
            onChange={(e) => e.target.value && setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="class-to">По дату</Label>
          <Input
            id="class-to"
            type="date"
            className="w-40"
            value={to}
            onChange={(e) => e.target.value && setTo(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Харчуються"
          value={myClass.total_students ? `${registered} із ${myClass.total_students}` : registered}
          hint={
            myClass.total_students
              ? 'учнів класу є в реєстрі харчування'
              : 'кількість учнів класу не вказана адміністрацією'
          }
          emphasis
        />
        <StatTile
          label="Замовили востаннє"
          value={last ? `${last.students_ordered} із ${last.students_registered}` : '—'}
          hint={last ? formatDate(last.menu_date) : 'даних ще немає'}
        />
        <StatTile
          label="У середньому за період"
          value={formatPercent(averagePct)}
          hint="від тих, хто харчується"
        />
      </div>

      {coverageQuery.isPending ? <LoadingState /> : null}
      {coverageQuery.error ? <ErrorState error={coverageQuery.error} /> : null}

      {!coverageQuery.isPending && rows.length === 0 ? (
        <EmptyState
          title="За цей період даних немає"
          hint="Дані з’являються після того, як хтось із класу замовив харчування."
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <ChartCard
            title="Замовили цього дня — % від тих, хто харчується"
            description="Показує пропуски: скільки дітей із реєстру справді замовили в конкретний день."
          >
            <CoverageTrendChart
              data={rows.map((row) => ({
                menu_date: row.menu_date,
                registered_pct: row.coverage_registered_pct,
                students_ordered: row.students_ordered,
                students_registered: row.students_registered,
              }))}
            />
          </ChartCard>

          {myClass.total_students === null ? (
            <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p>
                Другий показник — «харчуються, % від усього класу» — тут порожній, бо
                адміністрація ще не вказала, скільки всього дітей у класі. Система знає
                лише тих, кого внесли до реєстру харчування.
              </p>
            </div>
          ) : null}

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>День</TableHead>
                  <TableHead className="text-right">Замовили</TableHead>
                  <TableHead className="text-right">У реєстрі</TableHead>
                  <TableHead className="text-right">
                    Замовили, % від тих, хто харчується
                  </TableHead>
                  <TableHead className="text-right">
                    Харчуються, % від усього класу
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...rows].reverse().map((row) => (
                  <TableRow key={row.menu_date}>
                    <TableCell className="font-medium">{formatDate(row.menu_date)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.students_ordered}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {row.students_registered}
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
        </>
      ) : null}
    </div>
  )
}
