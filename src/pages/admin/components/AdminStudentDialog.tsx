import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Star, Trash2, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { restoreStudent, retireStudent } from '@/api/students'
import { useAuth } from '@/auth/AuthContext'
import { humanError } from '@/lib/errors'
import { formatDate, fullName, toIsoDate } from '@/lib/format'
import { useCredentialsFlow } from '@/hooks/useCredentialsFlow'
import { CredentialsDialog } from '@/components/common/CredentialsDialog'
import { ErrorState } from '@/components/common/states'
import { StudentProfileForm } from '@/components/students/StudentProfileForm'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StudentOrdersTab } from './StudentOrdersTab'
import { StudentTransferTab } from './StudentTransferTab'
import { DeleteStudentDialog } from './DeleteStudentDialog'
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
  const [error, setError] = useState<string | null>(null)
  const [confirmRetire, setConfirmRetire] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!student) return
    setError(null)
    setConfirmRetire(false)
    setConfirmDelete(false)
  }, [student])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['students'] })
    await queryClient.invalidateQueries({ queryKey: ['privilege-log'] })
  }

  const { role } = useAuth()

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

            <StudentProfileForm student={student} idPrefix="admin-student" unknownAuthor="невідомо хто" />

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

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-destructive/40 p-3">
              <p className="text-sm text-muted-foreground">
                {role === 'superadmin'
                  ? 'Видалення учня з історією замовлень стирає її зі звітів — перед цим буде окреме попередження.'
                  : 'Видалити можна лише учня, який ще жодного разу не харчувався, — наприклад, внесеного помилково.'}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="size-4" aria-hidden />
                Видалити учня
              </Button>
            </div>

            {error ? <ErrorState error={new Error(error)} /> : null}

            <DeleteStudentDialog
              student={student}
              open={confirmDelete}
              onOpenChange={setConfirmDelete}
              onDeleted={() => onOpenChange(false)}
            />
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
