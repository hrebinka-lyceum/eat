import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Star, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { getPrivilegeLog, restoreStudent, retireStudent, setPrivilege } from '@/api/students'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { formatDate, fullName, toIsoDate } from '@/lib/format'
import { useCredentialsFlow } from '@/hooks/useCredentialsFlow'
import { CredentialsDialog } from '@/components/common/CredentialsDialog'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StudentOrdersTab } from './StudentOrdersTab'
import { StudentTransferTab } from './StudentTransferTab'
import type { StudentWithClass } from '@/api/students'

/** Картка учня для адміністрації: усе про одну дитину в одному місці. */
export function AdminStudentDialog({
  student,
  onOpenChange,
}: {
  student: StudentWithClass | null
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const credentials = useCredentialsFlow()
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
    },
    onError: (err) => setError(humanError(err)),
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
    },
    onError: (err) => setError(humanError(err)),
  })

  if (!student) return null

  // Пароль показуємо поверх картки — його не можна загубити через
  // випадкове закриття вікна.
  if (credentials.credentials) {
    return (
      <CredentialsDialog
        credentials={credentials.credentials}
        title={credentials.title}
        skipped={credentials.skipped}
        onClose={credentials.close}
      />
    )
  }

  const lastLog = logQuery.data?.[0] ?? null

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(46rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2">
            {fullName(student.last_name, student.first_name)}
            {student.is_privileged ? (
              <Badge variant="secondary">
                <Star className="size-3" aria-hidden />
                Пільга
              </Badge>
            ) : null}
            {student.is_active ? null : <Badge variant="secondary">Вибув</Badge>}
          </DialogTitle>
          <DialogDescription>
            Клас {student.classes?.name ?? '—'} · харчується з{' '}
            {formatDate(student.enrolled_from)}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="profile">
          <TabsList>
            <TabsTrigger value="profile">Профіль</TabsTrigger>
            <TabsTrigger value="orders">Замовлення</TabsTrigger>
            <TabsTrigger value="transfer">Переведення</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3">
              {student.profile_id ? (
                <>
                  <span className="flex items-center gap-2 text-sm">
                    <KeyRound className="size-4 text-muted-foreground" aria-hidden />
                    Логін видано
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={credentials.busy}
                    onClick={() => void credentials.reset(student.profile_id!)}
                  >
                    {credentials.busy ? 'Скидаємо…' : 'Скинути пароль'}
                  </Button>
                </>
              ) : (
                <>
                  <span className="text-sm text-muted-foreground">
                    Логіна немає — замовляти за учня може керівник або адміністрація.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={credentials.busy || !student.is_active}
                    onClick={() =>
                      void credentials.issue(
                        [student.id],
                        new Map([[student.id, fullName(student.last_name, student.first_name)]]),
                      )
                    }
                  >
                    {credentials.busy ? 'Видаємо…' : 'Видати логін'}
                  </Button>
                </>
              )}
            </div>

            <div className="space-y-3 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="admin-privileged">Пільгове харчування</Label>
                <Switch
                  id="admin-privileged"
                  checked={privileged}
                  onCheckedChange={setPrivileged}
                />
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="admin-note"
                  className="text-xs font-normal text-muted-foreground"
                >
                  Підстава (документ, рішення)
                </Label>
                <Textarea
                  id="admin-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              {lastLog ? (
                <p className="text-xs text-muted-foreground">
                  Останній запис: {lastLog.new_value ? 'пільгу поставлено' : 'пільгу знято'}{' '}
                  {formatDate(lastLog.changed_at)} —{' '}
                  {lastLog.profiles?.full_name ?? 'невідомо хто'}
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">Пільговий статус ще не змінювали.</p>
              )}
              <Button size="sm" disabled={savePrivilege.isPending} onClick={() => savePrivilege.mutate()}>
                {savePrivilege.isPending ? 'Зберігаємо…' : 'Зберегти'}
              </Button>
            </div>

            <div className="rounded-lg border border-dashed p-3">
              {student.is_active ? (
                confirmRetire ? (
                  <div className="space-y-2">
                    <p className="text-sm">
                      Прибрати з реєстру харчування? Учень зникне зі списків, але всі
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
                )
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={restore.isPending}
                  onClick={() => restore.mutate()}
                >
                  <UserPlus className="size-4" aria-hidden />
                  Повернути в реєстр
                </Button>
              )}
            </div>

            {error ? <ErrorState error={new Error(error)} /> : null}
          </TabsContent>

          <TabsContent value="orders" className="pt-4">
            <StudentOrdersTab student={student} />
          </TabsContent>

          <TabsContent value="transfer" className="pt-4">
            <StudentTransferTab student={student} onDone={() => onOpenChange(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
