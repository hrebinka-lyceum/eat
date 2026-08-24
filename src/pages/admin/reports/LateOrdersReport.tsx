import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Info } from 'lucide-react'
import { lateOrders } from '@/api/reports'
import { monthValueBounds, toMonthValue, formatMonthValue } from '@/lib/dates'
import { formatDate, fullName } from '@/lib/format'
import { ReportFrame } from '@/components/common/ReportFrame'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
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

/**
 * Пізні замовлення. Кожне з них означає, що кухня готувала понад
 * порахований аркуш. Купа таких з одного класу — не порушення, а сигнал,
 * що клас не встигає до дедлайну.
 */
export default function LateOrdersReport() {
  const [month, setMonth] = useState(toMonthValue())
  const [from, to] = monthValueBounds(month)

  const ordersQuery = useQuery({
    queryKey: ['late-orders', from, to],
    queryFn: () => lateOrders(from, to),
    placeholderData: (previous) => previous,
  })

  const rows = ordersQuery.data ?? []

  const byClass = useMemo(() => {
    const map = new Map<string, number>()
    for (const row of rows) {
      const name = row.classes?.name ?? '—'
      map.set(name, (map.get(name) ?? 0) + 1)
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1])
  }, [rows])

  return (
    <ReportFrame
      title="Пізні замовлення"
      description="Замовлення, додані після закінчення прийому — понад порахований кухнею аркуш."
      periodLabel={formatMonthValue(month)}
      params={
        <div className="space-y-2">
          <Label htmlFor="late-month">Місяць</Label>
          <Input
            id="late-month"
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
          filename={`пізні-замовлення-${month}.csv`}
          columns={[
            { header: 'Дата харчування', value: (r) => r.menu_date },
            { header: 'Клас', value: (r) => r.classes?.name ?? '' },
            {
              header: 'Учень',
              value: (r) => (r.students ? fullName(r.students.last_name, r.students.first_name) : ''),
            },
            { header: 'Хто додав', value: (r) => r.profiles?.full_name ?? '' },
            { header: 'Коли додано', value: (r) => r.created_at },
          ]}
        />
      }
    >
      {ordersQuery.isPending ? <LoadingState /> : null}
      {ordersQuery.error ? <ErrorState error={ordersQuery.error} /> : null}

      {!ordersQuery.isPending && rows.length === 0 ? (
        <EmptyState
          title="Пізніх замовлень за цей місяць немає"
          hint="Усі замовлення зроблені вчасно."
        />
      ) : null}

      {rows.length > 0 ? (
        <>
          <div className="flex flex-wrap items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>
              Усього {rows.length} за місяць. По класах:{' '}
              {byClass.map(([name, count]) => `${name} — ${count}`).join(', ')}.
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата харчування</TableHead>
                  <TableHead>Клас</TableHead>
                  <TableHead>Учень</TableHead>
                  <TableHead>Хто додав</TableHead>
                  <TableHead>Коли додано</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{formatDate(row.menu_date)}</TableCell>
                    <TableCell>{row.classes?.name ?? '—'}</TableCell>
                    <TableCell>
                      {row.students
                        ? fullName(row.students.last_name, row.students.first_name)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {row.profiles?.full_name ?? 'невідомо'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Intl.DateTimeFormat('uk-UA', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                        timeZone: 'Europe/Kyiv',
                      }).format(new Date(row.created_at))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : null}
    </ReportFrame>
  )
}
