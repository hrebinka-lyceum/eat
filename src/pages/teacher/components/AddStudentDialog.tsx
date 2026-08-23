import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createStudent } from '@/api/students'
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

/**
 * Додавання учня до реєстру харчування.
 *
 * У реєстр вносяться ЛИШЕ ті, хто справді їсть у школі, — це не список
 * класу. Пояснення стоїть просто у вікні, бо саме тут його переплутати
 * найлегше.
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
  const [enrolledFrom, setEnrolledFrom] = useState(toIsoDate())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setLastName('')
    setFirstName('')
    setEnrolledFrom(toIsoDate())
    setError(null)
  }, [open])

  const mutation = useMutation({
    mutationFn: () =>
      createStudent({
        class_id: classId,
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        enrolled_from: enrolledFrom,
      }),
    onSuccess: async (student) => {
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      toast.success(`${student.last_name} ${student.first_name} — у реєстрі`)
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
    if (!enrolledFrom) {
      setError('Вкажіть, з якої дати учень харчується.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Додати учня</DialogTitle>
            <DialogDescription>
              У списку харчування — лише ті, хто справді їсть у школі. Це не список
              класу: тих, хто носить їжу з дому чи ходить додому, вносити не треба.
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
            <div className="space-y-2">
              <Label htmlFor="student-from">Харчується з</Label>
              <Input
                id="student-from"
                type="date"
                value={enrolledFrom}
                onChange={(e) => setEnrolledFrom(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                За замовчуванням сьогодні. Якщо список вносите пізніше, ніж діти
                почали харчуватися, поставте справжню дату — від неї рахується
                статистика.
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
