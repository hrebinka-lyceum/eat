import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { getPrivilegeLog, restoreStudent, retireStudent, setPrivilege } from '@/api/students'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { formatDate, fullName, toIsoDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/common/states'
import type { Student } from '@/types/database'

/**
 * Картка учня: пільговий статус, примітка й останній запис журналу.
 *
 * Журнал тут не для звітності, а щоб після переведення учня з іншого класу
 * було видно, хто і коли поставив пільгу — документи збирає то керівник,
 * то адміністрація.
 */
export function StudentCardDialog({
  student,
  onOpenChange,
}: {
  student: Student | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const [privileged, setPrivileged] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [confirmRetire, setConfirmRetire] = useState(false)

  useEffect(() => {
    if (!student) return
    setPrivileged(student.is_privileged)
    setNote(student.privilege_note ?? '')
    setError(null)
    setConfirmRetire(false)
  }, [student])

  const logQuery = useQuery({
    queryKey: qk.privilegeLog(student?.id ?? ''),
    queryFn: () => getPrivilegeLog(student!.id, 3),
    enabled: Boolean(student),
  })

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['students'] })
    await queryClient.invalidateQueries({ queryKey: ['privilege-log'] })
  }

  const savePrivilege = useMutation({
    mutationFn: () => setPrivilege(student!.id, privileged, note.trim() || null),
    onSuccess: async () => {
      await invalidate()
      toast.success('Збережено')
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err, 'Не вдалося зберегти пільговий статус.')),
  })

  const retire = useMutation({
    mutationFn: () => retireStudent(student!.id, toIsoDate()),
    onSuccess: async () => {
      await invalidate()
      toast.success('Учня прибрано з реєстру харчування')
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err)),
  })

  const restore = useMutation({
    mutationFn: () => restoreStudent(student!.id),
    onSuccess: async () => {
      await invalidate()
      toast.success('Учня повернуто в реєстр')
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err)),
  })

  if (!student) return null

  const lastLog = logQuery.data?.[0] ?? null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{fullName(student.last_name, student.first_name)}</DialogTitle>
          <DialogDescription>
            Харчується з {formatDate(student.enrolled_from)}
            {student.is_active ? '' : ` · вибув ${formatDate(student.left_at)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 text-sm">
            {student.profile_id ? (
              <Badge variant="secondary">
                <KeyRound className="size-3" aria-hidden />
                Має логін
              </Badge>
            ) : (
              <span className="text-muted-foreground">
                Логіна немає — замовлення за нього робите ви. Це нормальний стан.
              </span>
            )}
          </div>

          <div className="space-y-3 rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="privileged">Пільгове харчування</Label>
              <Switch id="privileged" checked={privileged} onCheckedChange={setPrivileged} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="privilege-note" className="text-xs font-normal text-muted-foreground">
                Підстава (документ, рішення)
              </Label>
              <Textarea
                id="privilege-note"
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Наприклад: довідка про статус ВПО від 02.09.2026"
              />
            </div>

            {lastLog ? (
              <p className="text-xs text-muted-foreground">
                Останній запис: {lastLog.new_value ? 'пільгу поставлено' : 'пільгу знято'}{' '}
                {formatDate(lastLog.changed_at)} —{' '}
                {lastLog.profiles?.full_name ?? 'адміністрація школи'}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Пільговий статус ще не змінювали.</p>
            )}
          </div>

          {student.is_active ? (
            <div className="rounded-lg border border-dashed p-3">
              {confirmRetire ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    Прибрати з реєстру харчування? Учень зникне зі списку, але всі його
                    замовлення й статистика залишаться.
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={retire.isPending}
                      onClick={() => retire.mutate()}
                    >
                      Так, прибрати
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirmRetire(false)}>
                      Скасувати
                    </Button>
                  </div>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setConfirmRetire(true)}>
                  <UserMinus className="size-4" aria-hidden />
                  Більше не харчується
                </Button>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed p-3">
              <Button
                variant="ghost"
                size="sm"
                disabled={restore.isPending}
                onClick={() => restore.mutate()}
              >
                <UserPlus className="size-4" aria-hidden />
                Повернути в реєстр
              </Button>
            </div>
          )}

          {error ? <ErrorState error={new Error(error)} /> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Закрити
          </Button>
          <Button disabled={savePrivilege.isPending} onClick={() => savePrivilege.mutate()}>
            {savePrivilege.isPending ? 'Зберігаємо…' : 'Зберегти'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
