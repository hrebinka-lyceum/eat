import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { privilegeLogFor, privilegedStudents, type PrivilegeLogRow } from '@/api/reports'
import { studentMonths } from '@/api/stats'
import { formatMonthValue, monthValueBounds, toMonthValue } from '@/lib/dates'
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
 * Пільговики з підставами — той папір, який просять першим, коли питають,
 * на якій підставі дитина харчується безкоштовно.
 */
export default function PrivilegedReport() {
  const [month, setMonth] = useState(toMonthValue())
  const [from] = monthValueBounds(month)

  const studentsQuery = useQuery({
    queryKey: ['privileged-students'],
    queryFn: privilegedStudents,
  })

  const ids = useMemo(
    () => (studentsQuery.data ?? []).map((student) => student.id),
    [studentsQuery.data],
  )

  const logQuery = useQuery({
    queryKey: ['privilege-log-bulk', ids.join(',')],
    queryFn: () => privilegeLogFor(ids),
    enabled: ids.length > 0,
  })

  const monthQuery = useQuery({
    queryKey: ['student-month', from, 'all'],
    queryFn: () => studentMonths(from),
    placeholderData: (previous) => previous,
  })

  // Журнал приходить відсортованим за спаданням, тож перший запис по учню —
  // і є останній за часом.
  const lastLog = useMemo(() => {
    const map = new Map<string, PrivilegeLogRow>()
    for (const entry of logQuery.data ?? []) {
      if (!map.has(entry.student_id)) map.set(entry.student_id, entry)
    }
    return map
  }, [logQuery.data])

  const daysByStudent = useMemo(
    () => new Map((monthQuery.data ?? []).map((item) => [item.student_id, item.days_ordered])),
    [monthQuery.data],
  )

  const rows = studentsQuery.data ?? []

  return (
    <ReportFrame
      title="Пільгові учні"
      description="Хто має пільгове харчування, на якій підставі та хто цей статус поставив."
      periodLabel={`станом на сьогодні, харчування за ${formatMonthValue(month)}`}
      params={
        <div className="space-y-2">
          <Label htmlFor="privileged-month">Місяць для підрахунку днів</Label>
          <Input
            id="privileged-month"
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
          filename={`пільговики-${month}.csv`}
          columns={[
            { header: 'Учень', value: (r) => fullName(r.last_name, r.first_name) },
            { header: 'Клас', value: (r) => r.classes?.name ?? '' },
            { header: 'Підстава', value: (r) => r.privilege_note ?? '' },
            {
              header: 'Статус поставив',
              value: (r) => lastLog.get(r.id)?.profiles?.full_name ?? '',
            },
            {
              header: 'Дата встановлення',
              value: (r) => lastLog.get(r.id)?.changed_at?.slice(0, 10) ?? '',
            },
            { header: 'Днів харчування за місяць', value: (r) => daysByStudent.get(r.id) ?? 0 },
          ]}
        />
      }
    >
      {studentsQuery.isPending ? <LoadingState /> : null}
      {studentsQuery.error ? <ErrorState error={studentsQuery.error} /> : null}

      {!studentsQuery.isPending && rows.length === 0 ? (
        <EmptyState
          title="Пільговиків у реєстрі немає"
          hint="Статус ставиться в картці учня — класним керівником або адміністрацією."
        />
      ) : null}

      {rows.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Учень</TableHead>
                <TableHead>Клас</TableHead>
                <TableHead>Підстава</TableHead>
                <TableHead>Статус поставив</TableHead>
                <TableHead className="text-right">Днів за місяць</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((student) => {
                const log = lastLog.get(student.id)
                return (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {fullName(student.last_name, student.first_name)}
                    </TableCell>
                    <TableCell>{student.classes?.name ?? '—'}</TableCell>
                    <TableCell className="max-w-72 text-muted-foreground">
                      {student.privilege_note || 'не вказано'}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log ? (
                        <>
                          {log.profiles?.full_name ?? 'невідомо хто'}
                          <span className="block text-xs">{formatDate(log.changed_at)}</span>
                        </>
                      ) : (
                        'запису немає'
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {daysByStudent.get(student.id) ?? 0}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}
    </ReportFrame>
  )
}
