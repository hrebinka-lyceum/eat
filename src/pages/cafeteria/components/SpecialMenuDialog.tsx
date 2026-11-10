import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { saveSpecialMenu, type SpecialMenuWithClasses } from '@/api/specialMenus'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { formatDateWithWeekday, specialMenuLabel } from '@/lib/format'
import { SCHOOL_LEVELS, schoolLevel } from '@/lib/grades'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

/**
 * Створення або зміна спеціального меню: назва (необов'язкова) і класи.
 *
 * Клас на день може бути лише в одному спеціальному меню — класи, зайняті
 * іншим меню цього дня, показуються, але вимкнені, з назвою того меню.
 * Те саме правило перевіряє й сервер (save_special_menu), разом із забороною
 * переносити клас, у якого на цей день уже є замовлення.
 */
export function SpecialMenuDialog({
  open,
  onOpenChange,
  menuDate,
  menu,
  dayMenus,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  menuDate: string
  /** null — нове меню */
  menu: SpecialMenuWithClasses | null
  /** усі спеціальні меню цього дня — щоб знати, які класи вже зайняті */
  dayMenus: SpecialMenuWithClasses[]
  onSaved: (id: string) => void
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [chosen, setChosen] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const year = settingsQuery.data?.current_year
  const classesQuery = useQuery({
    queryKey: qk.classes(year),
    queryFn: () => listClasses(year!),
    enabled: Boolean(year),
  })
  const classes = useMemo(() => classesQuery.data ?? [], [classesQuery.data])

  useEffect(() => {
    if (!open) return
    setName(menu?.name ?? '')
    setChosen(new Set(menu?.classes.map((klass) => klass.id) ?? []))
    setError(null)
  }, [open, menu])

  // Клас → назва іншого меню цього дня, де він уже є.
  const takenBy = useMemo(() => {
    const map = new Map<string, string>()
    for (const other of dayMenus) {
      if (other.id === menu?.id) continue
      for (const klass of other.classes) map.set(klass.id, specialMenuLabel(other.name))
    }
    return map
  }, [dayMenus, menu])

  const free = classes.filter((klass) => !takenBy.has(klass.id))

  const toggle = (classId: string, include: boolean) =>
    setChosen((current) => {
      const next = new Set(current)
      if (include) next.add(classId)
      else next.delete(classId)
      return next
    })

  // Ланка цілком: якщо всі її вільні класи вже обрано — знімаємо, інакше додаємо.
  const toggleLevel = (level: string) => {
    const ids = free.filter((klass) => schoolLevel(klass.name) === level).map((klass) => klass.id)
    const all = ids.length > 0 && ids.every((id) => chosen.has(id))
    setChosen((current) => {
      const next = new Set(current)
      for (const id of ids) {
        if (all) next.delete(id)
        else next.add(id)
      }
      return next
    })
  }

  const mutation = useMutation({
    mutationFn: () =>
      saveSpecialMenu({ menuDate, name, classIds: [...chosen], id: menu?.id ?? null }),
    onSuccess: async (id) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['special-menus'] }),
        queryClient.invalidateQueries({ queryKey: ['menu-items-plain'] }),
      ])
      toast.success(menu ? 'Спеціальне меню збережено' : 'Спеціальне меню створено — додайте склад')
      onSaved(id)
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err, 'Не вдалося зберегти спеціальне меню.')),
  })

  const submit = () => {
    setError(null)
    if (chosen.size === 0) {
      setError('Оберіть хоча б один клас.')
      return
    }
    mutation.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[min(36rem,calc(100%-2rem))]">
        <DialogHeader>
          <DialogTitle>{menu ? 'Змінити спеціальне меню' : 'Нове спеціальне меню'}</DialogTitle>
          <DialogDescription>
            На {formatDateWithWeekday(menuDate)}. Для обраних класів це меню замінить основне:
            їхні учні бачитимуть і замовлятимуть лише його.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-2">
            <Label htmlFor="special-menu-name">Назва (необов’язково)</Label>
            <Input
              id="special-menu-name"
              placeholder="Наприклад, дієтичне"
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Для яких класів</legend>
            <div className="flex flex-wrap gap-2">
              {SCHOOL_LEVELS.map(({ level, grades }) => (
                <Button
                  key={level}
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!free.some((klass) => schoolLevel(klass.name) === level)}
                  onClick={() => toggleLevel(level)}
                >
                  {grades}
                </Button>
              ))}
            </div>

            {classesQuery.error ? <ErrorState error={classesQuery.error} /> : null}
            <div className="grid grid-cols-3 gap-x-3 gap-y-2 sm:grid-cols-4">
              {classes.map((klass) => {
                const other = takenBy.get(klass.id)
                const id = `special-class-${klass.id}`
                return (
                  <div key={klass.id} className="flex items-center gap-2">
                    <Checkbox
                      id={id}
                      checked={chosen.has(klass.id)}
                      disabled={Boolean(other)}
                      onCheckedChange={(value) => toggle(klass.id, value === true)}
                    />
                    <Label htmlFor={id} className={other ? 'text-muted-foreground' : undefined}>
                      {klass.name}
                      {other ? <span className="sr-only"> — уже в меню «{other}»</span> : null}
                    </Label>
                  </div>
                )
              })}
            </div>
            {takenBy.size > 0 ? (
              <p className="text-xs text-muted-foreground">
                Вимкнені класи вже мають інше спеціальне меню на цей день.
              </p>
            ) : null}
          </fieldset>

          {error ? <ErrorState error={new Error(error)} /> : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button type="button" disabled={mutation.isPending} onClick={submit}>
            {mutation.isPending ? 'Зберігаємо…' : menu ? 'Зберегти' : 'Створити'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
