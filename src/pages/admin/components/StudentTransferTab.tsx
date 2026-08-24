import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getEnrollments, transferStudent } from '@/api/students'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { formatDate, toIsoDate } from '@/lib/format'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Student } from '@/types/database'

/**
 * Переведення в інший клас.
 *
 * Історію веде transfer_student, а не клієнт: вона закриває поточний запис
 * у class_enrollments і відкриває новий. Завдяки цьому переведення в
 * листопаді не переписує жовтневу статистику.
 */
export function StudentTransferTab({
  student,
  onDone,
}: {
  student: Student
  onDone: () => void
}) {
  const queryClient = useQueryClient()
  const [classId, setClassId] = useState('')
  const [fromDate, setFromDate] = useState(toIsoDate())
  const [error, setError] = useState<string | null>(null)

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const classesQuery = useQuery({
    queryKey: qk.classes(settingsQuery.data?.current_year),
    queryFn: () => listClasses(settingsQuery.data!.current_year),
    enabled: Boolean(settingsQuery.data),
  })

  const historyQuery = useQuery({
    queryKey: ['enrollments', student.id],
    queryFn: () => getEnrollments(student.id),
  })

  const classes = (classesQuery.data ?? []).filter((item) => item.id !== student.class_id)
  const nameOf = (id: string) =>
    (classesQuery.data ?? []).find((item) => item.id === id)?.name ?? '—'

  const transfer = useMutation({
    mutationFn: () => transferStudent(student.id, classId, fromDate),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      await queryClient.invalidateQueries({ queryKey: ['enrollments'] })
      await queryClient.invalidateQueries({ queryKey: ['orders-of-class'] })
      toast.success('Учня переведено')
      onDone()
    },
    onError: (err) => setError(humanError(err)),
  })

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Зараз у класі <strong className="text-foreground">{nameOf(student.class_id)}</strong>.
          Замовлення від дати переведення поїдуть за учнем — кухня рахує по класах, і порція
          має опинитись там, де дитина справді обідатиме. Минулі замовлення лишаються
          в старому класі.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="transfer-class">Новий клас</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger id="transfer-class" className="w-48">
                <SelectValue placeholder="Оберіть клас" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="transfer-date">З дати</Label>
            <Input
              id="transfer-date"
              type="date"
              className="w-44"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>

          <Button
            className="mb-1"
            disabled={!classId || transfer.isPending}
            onClick={() => {
              setError(null)
              transfer.mutate()
            }}
          >
            {transfer.isPending ? 'Переводимо…' : 'Перевести'}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Дата має бути пізнішою за початок поточного запису історії, інакше база
          відмовить: два записи не можуть діяти одночасно.
        </p>

        {error ? <ErrorState error={new Error(error)} /> : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-medium">Історія класів</h3>
        {historyQuery.isPending ? <LoadingState /> : null}
        {historyQuery.error ? <ErrorState error={historyQuery.error} /> : null}
        <ul className="space-y-1 text-sm text-muted-foreground">
          {(historyQuery.data ?? []).map((row) => (
            <li key={row.id}>
              {nameOf(row.class_id)} — з {formatDate(row.from_date)}
              {row.to_date ? ` до ${formatDate(row.to_date)}` : ' (поточний)'}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
