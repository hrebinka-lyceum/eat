import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createStudent, NO_PRIVILEGE, privilegeFields, type PrivilegeSelection } from '@/api/students'
import { humanError } from '@/lib/errors'
import { toIsoDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorState } from '@/components/common/states'
import { GenderSelect, PrivilegeMultiSelect } from '@/components/students/StudentFields'
import type { Gender } from '@/types/database'

/**
 * Додавання учня до списку класу.
 *
 * У список вносяться ВСІ учні класу, і ті, хто не харчується: охоплення
 * рахується від усього класу. Пояснення стоїть просто у вікні, бо саме тут
 * його переплутати найлегше.
 */
export function AddStudentDialog({
  open,
  onOpenChange,
  classId,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  classId: string
}) {
  const queryClient = useQueryClient()
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [privilege, setPrivilege] = useState<PrivilegeSelection>(NO_PRIVILEGE)
  const [enrolledFrom, setEnrolledFrom] = useState(toIsoDate())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLastName('')
    setFirstName('')
    setGender(null)
    setPrivilege(NO_PRIVILEGE)
    setEnrolledFrom(toIsoDate())
    setError(null)
  }, [open])

  const mutation = useMutation({
    mutationFn: () =>
      createStudent({
        class_id: classId,
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        gender,
        ...privilegeFields(privilege),
        enrolled_from: enrolledFrom,
      }),
    onSuccess: async (student) => {
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success(`${student.last_name} ${student.first_name} — у списку класу`)
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err, 'Не вдалося додати учня.')),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!lastName.trim() || !firstName.trim()) {
      setError('Заповніть прізвище та ім’я.')
      return
    }
    // Стать потрібна для звітів за статтю — без неї дитина випаде з розрізу.
    if (!gender) {
      setError('Вкажіть стать.')
      return
    }
    if (!enrolledFrom) {
      setError('Вкажіть, з якої дати учень у класі.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(32rem,calc(100%-2rem))]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Додати учня</DialogTitle>
            <DialogDescription>
              Вносьте всіх учнів класу — і тих, хто не харчується: охоплення
              рахується від усього класу.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="student-last">Прізвище</Label>
              <Input
                id="student-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-first">Ім’я</Label>
              <Input
                id="student-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <GenderSelect id="student-gender" value={gender} onChange={setGender} />
              <PrivilegeMultiSelect
                id="student-privilege"
                value={privilege}
                initialIds={[]}
                onChange={setPrivilege}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="student-from">У класі з</Label>
              <Input
                id="student-from"
                type="date"
                value={enrolledFrom}
                onChange={(e) => setEnrolledFrom(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                За замовчуванням сьогодні. Якщо учень у класі з початку року, поставте
                1 вересня — від цієї дати він рахується в класі в статистиці охоплення.
              </p>
            </div>

            {error ? <ErrorState error={new Error(error)} /> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Додаємо…' : 'Додати'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
