import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getPrivilegeLog,
  privilegeSelectionOf,
  updateStudentProfile,
  type PrivilegeSelection,
} from '@/api/students'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorState } from '@/components/common/states'
import { GenderSelect, PrivilegeMultiSelect } from './StudentFields'
import type { Gender, Student } from '@/types/database'

/**
 * Профіль учня: ім'я, стать і пільгова категорія. Спільний для картки
 * класного керівника й картки адміністрації — права однакові (RLS дає
 * керівнику змінювати будь-яке поле учнів свого класу).
 */
export function StudentProfileForm({
  student,
  idPrefix,
  unknownAuthor,
  onSaved,
}: {
  student: Student
  /** щоб id полів не повторювалися, якщо на сторінці дві форми */
  idPrefix: string
  /** як назвати автора запису журналу, якого цій ролі не видно */
  unknownAuthor: string
  onSaved?: () => void
}) {
  const queryClient = useQueryClient()
  const [lastName, setLastName] = useState(student.last_name)
  const [firstName, setFirstName] = useState(student.first_name)
  const [gender, setGender] = useState<Gender | null>(student.gender)
  const [privilege, setPrivilege] = useState<PrivilegeSelection>(privilegeSelectionOf(student))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLastName(student.last_name)
    setFirstName(student.first_name)
    setGender(student.gender)
    setPrivilege(privilegeSelectionOf(student))
    setError(null)
  }, [student])

  const logQuery = useQuery({
    queryKey: qk.privilegeLog(student.id),
    queryFn: () => getPrivilegeLog(student.id, 3),
  })

  const save = useMutation({
    mutationFn: () => updateStudentProfile(student.id, { lastName, firstName, gender, privilege }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['students'] })
      await queryClient.invalidateQueries({ queryKey: ['privilege-log'] })
      await queryClient.invalidateQueries({ queryKey: ['privileged-students'] })
      toast.success('Збережено')
      onSaved?.()
    },
    onError: (err) => setError(humanError(err, 'Не вдалося зберегти зміни.')),
  })

  const submit = () => {
    setError(null)
    if (!lastName.trim() || !firstName.trim()) {
      setError('Прізвище та ім’я не можуть бути порожніми.')
      return
    }
    save.mutate()
  }

  const lastLog = logQuery.data?.[0] ?? null

  return (
    <div className="space-y-4 rounded-lg border p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-last`}>Прізвище</Label>
          <Input id={`${idPrefix}-last`} value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-first`}>Ім’я</Label>
          <Input id={`${idPrefix}-first`} value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <GenderSelect id={`${idPrefix}-gender`} value={gender} onChange={setGender} />
        <PrivilegeMultiSelect
          id={`${idPrefix}-privilege`}
          value={privilege}
          initialIds={student.privilege_category_ids ?? []}
          onChange={setPrivilege}
        />
      </div>

      {lastLog ? (
        <p className="text-xs text-muted-foreground">
          Пільга: {lastLog.new_value ? 'поставлена' : 'знята'} {formatDate(lastLog.changed_at)} —{' '}
          {lastLog.profiles?.full_name ?? unknownAuthor}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">Пільговий статус ще не змінювали.</p>
      )}

      {error ? <ErrorState error={new Error(error)} /> : null}

      <Button size="sm" disabled={save.isPending} onClick={submit}>
        {save.isPending ? 'Зберігаємо…' : 'Зберегти'}
      </Button>
    </div>
  )
}
