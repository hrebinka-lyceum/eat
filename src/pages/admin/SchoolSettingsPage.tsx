import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { getReportSettings, updateDirector } from '@/api/reportSettings'
import {
  createPrivilegeCategory,
  deletePrivilegeCategory,
  listPrivilegeCategories,
  updatePrivilegeCategory,
} from '@/api/privilegeCategories'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { directorName } from '@/lib/reportDocument'
import { PageHeader } from '@/components/common/PageHeader'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { PrivilegeCategory } from '@/types/database'

/**
 * Налаштування, які веде адміністрація (на відміну від системних, що лише в
 * суперадміна): хто затверджує звіти і довідник пільгових категорій.
 */
export default function SchoolSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Налаштування школи"
        description="Хто затверджує звіти і які пільгові категорії можна обрати в картці учня."
      />
      <DirectorCard />
      <CategoriesCard />
    </div>
  )
}

function DirectorCard() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: qk.reportSettings(), queryFn: getReportSettings })
  const [lastName, setLastName] = useState('')
  const [firstName, setFirstName] = useState('')

  useEffect(() => {
    if (!settingsQuery.data) return
    setLastName(settingsQuery.data.director_last_name)
    setFirstName(settingsQuery.data.director_first_name)
  }, [settingsQuery.data])

  const save = useMutation({
    mutationFn: () => updateDirector(lastName, firstName),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.reportSettings() })
      toast.success('Збережено')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    save.mutate()
  }

  const preview = directorName(firstName, lastName)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Директор</CardTitle>
        <CardDescription>
          Підставляється в шапку «ЗАТВЕРДЖУЮ» звіту про організацію харчування.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {settingsQuery.isLoading ? <LoadingState /> : null}
        {settingsQuery.error ? <ErrorState error={settingsQuery.error} /> : null}
        {settingsQuery.data === null ? (
          <ErrorState
            error={
              new Error(
                'Налаштувань звітів ще немає на сервері — потрібна міграція бази. ' +
                  'Зверніться до адміністратора системи.',
              )
            }
          />
        ) : null}

        {settingsQuery.data ? (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="director-last">Прізвище</Label>
                <Input id="director-last" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="director-first">Ім’я</Label>
                <Input id="director-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              У документі під словом «Директор»: ____________ {preview || '(ім’я не вказано)'}
            </p>
            <Button type="submit" size="sm" disabled={save.isPending}>
              {save.isPending ? 'Зберігаємо…' : 'Зберегти'}
            </Button>
          </form>
        ) : null}
      </CardContent>
    </Card>
  )
}

function CategoriesCard() {
  const queryClient = useQueryClient()
  const categoriesQuery = useQuery({
    queryKey: qk.privilegeCategories(),
    queryFn: listPrivilegeCategories,
  })
  const [name, setName] = useState('')
  const [toDelete, setToDelete] = useState<PrivilegeCategory | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: qk.privilegeCategories() })

  const create = useMutation({
    mutationFn: () => createPrivilegeCategory(name),
    onSuccess: async () => {
      await invalidate()
      setName('')
      toast.success('Категорію додано')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: { name?: string; is_active?: boolean } }) =>
      updatePrivilegeCategory(id, patch),
    onSuccess: async () => {
      await invalidate()
      toast.success('Збережено')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const remove = useMutation({
    mutationFn: (id: string) => deletePrivilegeCategory(id),
    onSuccess: async () => {
      await invalidate()
      setToDelete(null)
      toast.success('Категорію видалено')
    },
    onError: (err) => {
      setToDelete(null)
      toast.error(humanError(err))
    },
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (name.trim()) create.mutate()
  }

  const categories = categoriesQuery.data ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Пільгові категорії</CardTitle>
        <CardDescription>
          Класний керівник обирає категорію в картці учня. Категорію, якою вже позначено
          учнів, не видалити — вимкніть її, і вона перестане пропонуватися.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={onSubmit} className="flex flex-wrap items-end gap-2">
          <div className="min-w-64 flex-1 space-y-2">
            <Label htmlFor="category-name">Нова категорія</Label>
            <Input
              id="category-name"
              placeholder="Наприклад: діти з багатодітних сімей"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <Button type="submit" size="sm" disabled={!name.trim() || create.isPending}>
            <Plus className="size-4" aria-hidden />
            Додати
          </Button>
        </form>

        {categoriesQuery.isLoading ? <LoadingState /> : null}
        {categoriesQuery.error ? <ErrorState error={categoriesQuery.error} /> : null}

        {categoriesQuery.data && categories.length === 0 ? (
          <EmptyState title="Категорій ще немає" hint="Додайте першу — вона одразу з’явиться в картках учнів." />
        ) : null}

        {categories.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Назва</TableHead>
                  <TableHead className="w-28">Пропонується</TableHead>
                  <TableHead className="w-14" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <CategoryNameInput
                        category={category}
                        onRename={(next) => update.mutate({ id: category.id, patch: { name: next } })}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={category.is_active}
                        aria-label={`Пропонувати «${category.name}»`}
                        disabled={update.isPending}
                        onCheckedChange={(active) =>
                          update.mutate({ id: category.id, patch: { is_active: active } })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`Видалити «${category.name}»`}
                        onClick={() => setToDelete(category)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : null}

        {toDelete ? (
          <ConfirmDialog
            open
            onOpenChange={(open) => !open && setToDelete(null)}
            title={`Видалити категорію «${toDelete.name}»?`}
            description="Якщо нею вже позначено учнів, сервер відмовить — тоді просто вимкніть її."
            confirmLabel="Видалити"
            destructive
            busy={remove.isPending}
            onConfirm={() => remove.mutate(toDelete.id)}
          />
        ) : null}
      </CardContent>
    </Card>
  )
}

/** Перейменування на місці: зберігається, коли поле втрачає фокус. */
function CategoryNameInput({
  category,
  onRename,
}: {
  category: PrivilegeCategory
  onRename: (name: string) => void
}) {
  const [value, setValue] = useState(category.name)
  useEffect(() => setValue(category.name), [category.name])

  const commit = () => {
    const next = value.trim()
    if (!next) {
      setValue(category.name)
      return
    }
    if (next !== category.name) onRename(next)
  }

  return (
    <Input
      aria-label={`Назва категорії ${category.name}`}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}
