import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { KeyRound, UserMinus, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { restoreStudent, retireStudent } from '@/api/students'
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
import { Badge } from '@/components/ui/badge'
import { ErrorState } from '@/components/common/states'
import { CredentialsDialog } from '@/components/common/CredentialsDialog'
import { useCredentialsFlow } from '@/hooks/useCredentialsFlow'
import { StudentProfileForm } from '@/components/students/StudentProfileForm'
import type { Student } from '@/types/database'

/**
 * Картка учня: ім'я, стать, пільгова категорія, логін і вибуття.
 *
 * Останній запис журналу пільг — щоб після переведення учня з іншого класу
 * було видно, хто і коли поставив пільгу: документи збирає то керівник,
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
  const [error, setError] = useState<string | null>(null)
  const [confirmRetire, setConfirmRetire] = useState(false)
  const credentials = useCredentialsFlow()

  useEffect(() => {
    if (!student) return
    setError(null)
    setConfirmRetire(false)
  }, [student])

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['students'] })
    await queryClient.invalidateQueries({ queryKey: ['privilege-log'] })
  }

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

  // Вікно з паролем показуємо поверх картки: закривати картку не треба,
  // а пароль не має загубитися через випадкове закриття.
  if (credentials.credentials) {
    return (
      <CredentialsDialog
        credentials={credentials.credentials}
        title={credentials.title}
        onClose={credentials.close}
      />
    )
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(34rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>{fullName(student.last_name, student.first_name)}</DialogTitle>
          <DialogDescription>
            Харчується з {formatDate(student.enrolled_from)}
            {student.is_active ? '' : ` · вибув ${formatDate(student.left_at)}`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            {student.profile_id ? (
              <>
                <Badge variant="secondary">
                  <KeyRound className="size-3" aria-hidden />
                  Має логін
                </Badge>
                {/* Єдиний шлях відновлення доступу: пошта на цих логінах
                    синтетична, «відновити через email» не існує. */}
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
              <span className="text-muted-foreground">
                Логіна немає — замовлення за нього робите ви. Це нормальний стан.
              </span>
            )}
          </div>

          <StudentProfileForm
            student={student}
            idPrefix="student"
            unknownAuthor="адміністрація школи"
            onSaved={() => onOpenChange(false)}
          />

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
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
