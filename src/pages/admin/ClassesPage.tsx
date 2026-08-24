import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Info, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { createClass, deleteClass, setClassTeacher, setTotalStudents } from '@/api/classes'
import { listClasses } from '@/api/classes'
import { listStaff } from '@/api/profiles'
import { getSettings } from '@/api/settings'
import { useAuth } from '@/auth/AuthContext'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { csvFilename } from '@/lib/csv'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { Class } from '@/types/database'

const NO_TEACHER = 'none'

/**
 * Класи: розміри й керівники.
 *
 * classes.total_students — те саме число, без якого coverage_class_pct
 * лишається порожнім, а питання «яку частку класу охоплено» не має відповіді.
 */
export default function ClassesPage() {
  const queryClient = useQueryClient()
  const { role } = useAuth()
  const isSuperadmin = role === 'superadmin'
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newSize, setNewSize] = useState('')
  const [toDelete, setToDelete] = useState<Class | null>(null)
  const [sizes, setSizes] = useState<Record<string, string>>({})

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const year = settingsQuery.data?.current_year

  const classesQuery = useQuery({
    queryKey: qk.classes(year),
    queryFn: () => listClasses(year!),
    enabled: Boolean(year),
  })

  const staffQuery = useQuery({ queryKey: ['profiles', 'staff'], queryFn: listStaff })

  const teachers = useMemo(
    () => (staffQuery.data ?? []).filter((p) => p.role === 'teacher' && p.status === 'active'),
    [staffQuery.data],
  )

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ['classes'] })
    await queryClient.invalidateQueries({ queryKey: ['my-class'] })
  }

  const saveSize = useMutation({
    mutationFn: ({ id, size }: { id: string; size: number | null }) => setTotalStudents(id, size),
    onSuccess: async () => {
      await invalidate()
      toast.success('Розмір класу збережено')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const assignTeacher = useMutation({
    mutationFn: ({ id, teacherId }: { id: string; teacherId: string | null }) =>
      setClassTeacher(id, teacherId),
    onSuccess: async () => {
      await invalidate()
      toast.success('Керівника призначено')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const addClass = useMutation({
    mutationFn: () =>
      createClass({
        name: newName.trim(),
        academic_year: year!,
        total_students: newSize.trim() ? Number(newSize) : null,
      }),
    onSuccess: async () => {
      await invalidate()
      toast.success('Клас створено')
      setCreateOpen(false)
      setNewName('')
      setNewSize('')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const removeClass = useMutation({
    mutationFn: (item: Class) => deleteClass(item.id),
    onSuccess: async () => {
      await invalidate()
      toast.success('Клас видалено')
      setToDelete(null)
    },
    onError: (err) => {
      toast.error(humanError(err))
      setToDelete(null)
    },
  })

  const classes = classesQuery.data ?? []
  const withoutSize = classes.filter((item) => item.total_students === null)

  if (settingsQuery.isPending || classesQuery.isPending) return <LoadingState />
  if (settingsQuery.error) return <ErrorState error={settingsQuery.error} />
  if (classesQuery.error) return <ErrorState error={classesQuery.error} />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Класи"
        description={`Навчальний рік ${year}. Розмір класу потрібен, щоб рахувати охоплення.`}
        actions={
          <>
            <ExportButton
              rows={classes}
              filename={csvFilename('класи')}
              columns={[
                { header: 'Клас', value: (c) => c.name },
                { header: 'Навчальний рік', value: (c) => c.academic_year },
                {
                  header: 'Керівник',
                  value: (c) => teachers.find((t) => t.id === c.teacher_id)?.full_name ?? '',
                },
                { header: 'Учнів у класі', value: (c) => c.total_students ?? '' },
              ]}
            />
            {isSuperadmin ? (
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="size-4" aria-hidden />
                Додати клас
              </Button>
            ) : null}
          </>
        }
      />

      {withoutSize.length > 0 ? (
        <div className="flex items-start gap-2 rounded-lg border border-dashed p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p>
            Не вказано кількість учнів для: {withoutSize.map((item) => item.name).join(', ')}.
            Поки поле порожнє, у дашбордах не рахується відсоток «харчуються від усього класу» —
            система знає лише тих, кого внесли до реєстру харчування.
          </p>
        </div>
      ) : null}

      {classes.length === 0 ? (
        <EmptyState
          title="На цей рік класів немає"
          hint="Створіть їх вручну або скористайтеся переведенням року."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Клас</TableHead>
                <TableHead className="w-64">Класний керівник</TableHead>
                <TableHead className="w-40">Учнів у класі</TableHead>
                {isSuperadmin ? <TableHead className="w-16" /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {classes.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.name}</TableCell>
                  <TableCell>
                    <Select
                      value={item.teacher_id ?? NO_TEACHER}
                      disabled={assignTeacher.isPending}
                      onValueChange={(value) =>
                        assignTeacher.mutate({
                          id: item.id,
                          teacherId: value === NO_TEACHER ? null : value,
                        })
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEACHER}>Без керівника</SelectItem>
                        {teachers.map((teacher) => (
                          <SelectItem key={teacher.id} value={teacher.id}>
                            {teacher.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={0}
                      className="w-28"
                      placeholder="не вказано"
                      value={sizes[item.id] ?? (item.total_students?.toString() ?? '')}
                      onChange={(e) => setSizes((s) => ({ ...s, [item.id]: e.target.value }))}
                      onBlur={(e) => {
                        const raw = e.target.value.trim()
                        const next = raw === '' ? null : Number(raw)
                        if (next !== null && (!Number.isInteger(next) || next < 0)) {
                          toast.error('Кількість учнів — ціле невід’ємне число.')
                          return
                        }
                        if (next !== item.total_students) {
                          saveSize.mutate({ id: item.id, size: next })
                        }
                      }}
                    />
                  </TableCell>
                  {isSuperadmin ? (
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Видалити клас ${item.name}`}
                        onClick={() => setToDelete(item)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новий клас</DialogTitle>
            <DialogDescription>
              Назва має мати вигляд «7-А»: саме з неї переведення року визначає паралель.
              Клас створюється в році {year}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="class-name">Назва</Label>
              <Input
                id="class-name"
                className="max-w-32"
                placeholder="7-А"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="class-size">Учнів у класі</Label>
              <Input
                id="class-size"
                type="number"
                min={0}
                className="max-w-32"
                placeholder="не вказано"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>
              Скасувати
            </Button>
            <Button
              disabled={!newName.trim() || addClass.isPending}
              onClick={() => addClass.mutate()}
            >
              {addClass.isPending ? 'Створюємо…' : 'Створити'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Видалити клас ${toDelete?.name ?? ''}?`}
        description="Клас, у якому є учні або історія замовлень, видалити не вийде — база його не відпустить. Порожній клас зникне без сліду."
        confirmLabel="Видалити"
        destructive
        busy={removeClass.isPending}
        onConfirm={() => toDelete && removeClass.mutate(toDelete)}
      />
    </div>
  )
}
