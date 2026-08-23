import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { qk } from '@/lib/queryKeys'
import { ROLE_LABELS } from '@/lib/format'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ErrorState } from '@/components/common/states'
import type { UserRole } from '@/types/database'

type StaffRole = Exclude<UserRole, 'superadmin' | 'student'>

const STAFF_ROLES: StaffRole[] = ['teacher', 'cafeteria', 'admin']

const NO_CLASS = 'none'

/**
 * Створення співробітника. Логін і пароль генерує Edge Function; тут лише
 * ім'я, роль і, для класного керівника, клас.
 */
export function CreateStaffDialog({
  open,
  onOpenChange,
  busy,
  onCreate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onCreate: (fullName: string, role: StaffRole, classId?: string) => Promise<boolean>
}) {
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<StaffRole>('teacher')
  const [classId, setClassId] = useState<string>(NO_CLASS)
  const [error, setError] = useState<string | null>(null)

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const classesQuery = useQuery({
    queryKey: qk.classes(settingsQuery.data?.current_year),
    queryFn: () => listClasses(settingsQuery.data!.current_year),
    enabled: Boolean(settingsQuery.data),
  })

  useEffect(() => {
    if (!open) return
    setFullName('')
    setRole('teacher')
    setClassId(NO_CLASS)
    setError(null)
  }, [open])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const trimmed = fullName.trim()
    if (trimmed.split(/\s+/).length < 2) {
      setError('Вкажіть прізвище та ім’я — з них будується логін.')
      return
    }

    const created = await onCreate(
      trimmed,
      role,
      role === 'teacher' && classId !== NO_CLASS ? classId : undefined,
    )
    if (created) onOpenChange(false)
  }

  const classes = classesQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Новий співробітник</DialogTitle>
            <DialogDescription>
              Логін складеться з прізвища та ініціала, пароль згенерується автоматично.
              Обидва покажуться один раз одразу після створення.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="staff-name">Прізвище та ім’я</Label>
              <Input
                id="staff-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Петренко Оксана Іванівна"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="staff-role">Роль</Label>
              <Select value={role} onValueChange={(value) => setRole(value as StaffRole)}>
                <SelectTrigger id="staff-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAFF_ROLES.map((item) => (
                    <SelectItem key={item} value={item}>
                      {ROLE_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Суперадміністратора через цей екран створити не можна — таку роль
                можна лише призначити наявному користувачу.
              </p>
            </div>

            {role === 'teacher' ? (
              <div className="space-y-2">
                <Label htmlFor="staff-class">Клас</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger id="staff-class" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CLASS}>Поки без класу</SelectItem>
                    {classes.map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.name}
                        {item.teacher_id ? ' — вже має керівника' : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Якщо обрати клас, у якого вже є керівник, він буде замінений.
                </p>
              </div>
            ) : null}

            {error ? <ErrorState error={new Error(error)} /> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? 'Створюємо…' : 'Створити'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
