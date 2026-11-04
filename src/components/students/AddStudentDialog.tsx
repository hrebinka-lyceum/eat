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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GenderSelect, PrivilegeMultiSelect } from '@/components/students/StudentFields'
import type { Class, Gender } from '@/types/database'

export type ClassOption = Pick<Class, 'id' | 'name'>

/**
 * Додавання учня до списку класу — керівником у «Моєму класі» й
 * адміністрацією (з «Класів» чи з пошуку).
 *
 * У список вносяться ВСІ учні класу, і ті, хто не харчується: охоплення
 * рахується від усього класу. Пояснення стоїть просто у вікні, бо саме тут
 * його переплутати найлегше.
 *
 * Клас або заданий (`classId`), або обирається у вікні зі списку `classes`.
 */
export function AddStudentDialog({
  open,
  onOpenChange,
  classId,
  className,
  classes,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** клас, куди додаємо; без нього клас обирають у вікні */
  classId?: string
  /** назва заданого класу — для заголовка й повідомлення */
  className?: string
  /** з чого обирати, коли клас не задано */
  classes?: ClassOption[]
}) {
  const queryClient = useQueryClient()
  const [chosenClassId, setChosenClassId] = useState('')
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')
  const [gender, setGender] = useState<Gender | null>(null)
  const [privilege, setPrivilege] = useState<PrivilegeSelection>(NO_PRIVILEGE)
  const [enrolledFrom, setEnrolledFrom] = useState(toIsoDate())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setChosenClassId('')
    setLastName('')
    setFirstName('')
    setGender(null)
    setPrivilege(NO_PRIVILEGE)
    setEnrolledFrom(toIsoDate())
    setError(null)
  }, [open])

  const targetClassId = classId ?? chosenClassId
  const targetClassName =
    className ?? classes?.find((klass) => klass.id === targetClassId)?.name

  const mutation = useMutation({
    mutationFn: () =>
      createStudent({
        class_id: targetClassId,
        last_name: lastName.trim(),
        first_name: firstName.trim(),
        gender,
        ...privilegeFields(privilege),
        enrolled_from: enrolledFrom,
      }),
    onSuccess: async (student) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['students'] }),
        queryClient.invalidateQueries({ queryKey: ['student-search'] }),
      ])
      toast.success(
        `${student.last_name} ${student.first_name} — у списку класу${targetClassName ? ` ${targetClassName}` : ''}`,
      )
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err, 'Не вдалося додати учня.')),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!targetClassId) {
      setError('Оберіть клас.')
      return
    }
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
            <DialogTitle>{classId && className ? `Додати учня до ${className}` : 'Додати учня'}</DialogTitle>
            <DialogDescription>
              Вносьте всіх учнів класу — і тих, хто не харчується: охоплення
              рахується від усього класу.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {classId ? null : (
              <div className="space-y-2">
                <Label htmlFor="student-class">Клас</Label>
                <Select value={chosenClassId} onValueChange={setChosenClassId}>
                  <SelectTrigger id="student-class" className="w-40">
                    <SelectValue placeholder="Оберіть клас" />
                  </SelectTrigger>
                  <SelectContent>
                    {(classes ?? []).map((klass) => (
                      <SelectItem key={klass.id} value={klass.id}>
                        {klass.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="student-last">Прізвище</Label>
              <Input
                id="student-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                autoFocus={Boolean(classId)}
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
