import { useQuery } from '@tanstack/react-query'
import { listPurgeLog } from '@/api/admin'
import { listStaff } from '@/api/profiles'
import { csvFilename } from '@/lib/csv'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PurgeResult } from '@/types/database'

const SCOPE_LABELS: Record<string, string> = {
  orders: 'замовлення',
  menus: 'меню',
  privilege_log: 'журнал пільг',
  graduated_students: 'випущені учні',
}

function describeResult(result: unknown): string {
  const value = result as PurgeResult | null
  if (!value || typeof value !== 'object') return '—'
  const parts: string[] = []
  if (value.orders !== undefined) parts.push(`замовлень ${value.orders}`)
  if (value.menu_days !== undefined) parts.push(`днів меню ${value.menu_days}`)
  if (value.privilege_log !== undefined) parts.push(`записів журналу ${value.privilege_log}`)
  if (value.graduated_students !== undefined) parts.push(`учнів ${value.graduated_students}`)
  return parts.length > 0 ? parts.join(', ') : 'нічого не видалено'
}

/** Журнал незворотних операцій: слід має лишатися. */
export default function PurgeLogPage() {
  const logQuery = useQuery({ queryKey: ['purge-log'], queryFn: listPurgeLog })
  const staffQuery = useQuery({ queryKey: ['profiles', 'staff'], queryFn: listStaff })

  const nameOf = (id: string | null) =>
    (id && staffQuery.data?.find((p) => p.id === id)?.full_name) || 'невідомо'

  if (logQuery.isPending) return <LoadingState />
  if (logQuery.error) return <ErrorState error={logQuery.error} />

  const entries = logQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Журнал видалень"
        description="Хто, коли і що видаляв. Операція незворотна, тож слід лишається назавжди."
        actions={
          <ExportButton
            rows={entries}
            filename={csvFilename('журнал-видалень')}
            columns={[
              { header: 'Коли', value: (e) => e.performed_at },
              { header: 'Хто', value: (e) => nameOf(e.performed_by) },
              { header: 'Період з', value: (e) => e.period_from },
              { header: 'Період по', value: (e) => e.period_to },
              {
                header: 'Категорії',
                value: (e) => e.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(', '),
              },
              { header: 'Результат', value: (e) => describeResult(e.result) },
            ]}
          />
        }
      />

      {entries.length === 0 ? (
        <EmptyState
          title="Дані ще не видаляли"
          hint="Тут з’явиться запис після першої операції видалення."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Коли</TableHead>
                <TableHead>Хто</TableHead>
                <TableHead>Період</TableHead>
                <TableHead>Категорії</TableHead>
                <TableHead>Результат</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Intl.DateTimeFormat('uk-UA', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                      timeZone: 'Europe/Kyiv',
                    }).format(new Date(entry.performed_at))}
                  </TableCell>
                  <TableCell>{nameOf(entry.performed_by)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDate(entry.period_from)} — {formatDate(entry.period_to)}
                  </TableCell>
                  <TableCell>
                    {entry.scopes.map((s) => SCOPE_LABELS[s] ?? s).join(', ')}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {describeResult(entry.result)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
