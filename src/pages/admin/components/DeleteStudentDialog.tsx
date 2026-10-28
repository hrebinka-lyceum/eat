import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { deleteStudent, studentOrderSummary } from '@/api/students'
import { useAuth } from '@/auth/AuthContext'
import { humanError } from '@/lib/errors'
import { formatDate, fullName, plural } from '@/lib/format'
import { ConfirmDialog, DELETE_WORD } from '@/components/common/ConfirmDialog'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Student } from '@/types/database'

/**
 * Видалення учня. Перш ніж питати, рахуємо, що саме зникне:
 *  — замовлень немає (внесли помилково) — звичайне підтвердження;
 *  — замовлення є, а це адміністратор — видалити не можна, лише прибрати з реєстру;
 *  — замовлення є, а це суперадмін — окреме попередження про звіти заднім
 *    числом і підтвердження словом.
 */
export function DeleteStudentDialog({
  student,
  open,
  onOpenChange,
  onDeleted,
}: {
  student: Student
  open: boolean
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}) {
  const queryClient = useQueryClient()
  const { role } = useAuth()
  const name = fullName(student.last_name, student.first_name)

  const summaryQuery = useQuery({
    queryKey: ['student-order-summary', student.id],
    queryFn: () => studentOrderSummary(student.id),
    enabled: open,
    staleTime: 0,
  })

  const remove = useMutation({
    mutationFn: (force: boolean) => deleteStudent(student.id, { force }),
    onSuccess: async ({ accountNote }) => {
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      await queryClient.invalidateQueries({ queryKey: ['stats'] })
      await queryClient.invalidateQueries({ queryKey: ['purge-log'] })
      toast.success('Учня видалено')
      if (accountNote) toast.warning(accountNote)
      onOpenChange(false)
      onDeleted()
    },
    onError: (err) => toast.error(humanError(err)),
  })

  if (!open) return null

  const summary = summaryQuery.data
  const account = student.profile_id ? ' і його логін' : ''

  if (!summary) {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="pr-6">Видалити {name}?</DialogTitle>
            <DialogDescription>Перевіряємо, чи має учень замовлення…</DialogDescription>
          </DialogHeader>
          {summaryQuery.error ? <ErrorState error={summaryQuery.error} /> : <LoadingState />}
        </DialogContent>
      </Dialog>
    )
  }

  if (summary.count === 0) {
    return (
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title={`Видалити ${name}?`}
        description={`Учень ще жодного разу не харчувався. Картку${account} буде видалено назавжди.`}
        confirmLabel="Видалити"
        destructive
        busy={remove.isPending}
        onConfirm={() => remove.mutate(false)}
      />
    )
  }

  const orders = `${summary.count} ${plural(summary.count, 'замовлення', 'замовлення', 'замовлень')}`
  const period = `з ${formatDate(summary.first)} по ${formatDate(summary.last)}`

  if (role !== 'superadmin') {
    return (
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="pr-6">{name} має історію харчування</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  За учнем {orders} {period}. Видалити його разом з ними може лише
                  суперадміністратор.
                </p>
                <p>Якщо учень більше не харчується, позначте «Більше не харчується» — історія лишиться.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Зрозуміло
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={`Повністю видалити ${name}?`}
      confirmLabel="Видалити назавжди"
      confirmWord={DELETE_WORD}
      destructive
      busy={remove.isPending}
      onConfirm={() => remove.mutate(true)}
    >
      <Alert variant="destructive">
        <TriangleAlert className="size-4" aria-hidden />
        <AlertTitle>Разом з учнем зникне вся його історія</AlertTitle>
        <AlertDescription>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              {orders} {period} — назавжди.
            </li>
            <li>
              Звіти за ці місяці зміняться заднім числом: відшкодування, табелі, охоплення —
              зокрема ті, що вже здані.
            </li>
            <li>Картка учня{account}, історія класів і журнал пільг.</li>
          </ul>
          <p className="mt-2">
            Скасувати це неможливо. Запис про видалення лишиться в журналі видалень. Якщо учень
            просто більше не харчується, краще позначте «Більше не харчується».
          </p>
        </AlertDescription>
      </Alert>
    </ConfirmDialog>
  )
}
