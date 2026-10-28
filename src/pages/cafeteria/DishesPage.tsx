import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { deleteDish, listDishes, setDishActive } from '@/api/dishes'
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
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DishDialog } from './components/DishDialog'
import type { Dish } from '@/types/database'

/**
 * Довідник компонентів блюда. Цін тут немає: вартість указується одна на все
 * блюдо дня в редакторі меню, а не за кожну складову.
 */
export default function DishesPage() {
  const queryClient = useQueryClient()
  const [showInactive, setShowInactive] = useState(false)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Dish | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toDelete, setToDelete] = useState<Dish | null>(null)

  const dishesQuery = useQuery({
    queryKey: qk.dishes(showInactive),
    queryFn: () => listDishes({ includeInactive: showInactive }),
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['dishes'] })

  const toggleActive = useMutation({
    mutationFn: ({ dish, active }: { dish: Dish; active: boolean }) =>
      setDishActive(dish.id, active),
    onSuccess: async (dish) => {
      await invalidate()
      toast.success(dish.is_active ? `«${dish.name}» знову в обігу` : `«${dish.name}» більше не пропонується`)
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const removeDish = useMutation({
    mutationFn: (dish: Dish) => deleteDish(dish.id),
    onSuccess: async () => {
      await invalidate()
      toast.success('Страву видалено')
      setToDelete(null)
    },
    onError: (err) => {
      toast.error(humanError(err))
      setToDelete(null)
    },
  })

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (dishesQuery.data ?? []).filter(
      (dish) => !term || dish.name.toLowerCase().includes(term),
    )
  }, [dishesQuery.data, search])

  const openCreate = () => {
    setEditing(null)
    setDialogOpen(true)
  }

  const openEdit = (dish: Dish) => {
    setEditing(dish)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Довідник компонентів"
        description="Складові блюда: гречана каша, котлета, чай. Вартість указується одна на все блюдо."
        actions={
          <>
            <ExportButton
              rows={visible}
              filename={csvFilename('компоненти')}
              columns={[
                { header: 'Назва', value: (d) => d.name },
                { header: 'Активний', value: (d) => d.is_active },
              ]}
            />
            <Button size="sm" onClick={openCreate}>
              <Plus className="size-4" aria-hidden />
              Додати компонент
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1 space-y-2">
          <Label htmlFor="dish-search">Пошук</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="dish-search"
              className="pl-8"
              placeholder="Назва компонента"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2 pb-2">
          <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="show-inactive" className="font-normal">
            Показати неактивні
          </Label>
        </div>
      </div>

      {dishesQuery.isPending ? <LoadingState /> : null}
      {dishesQuery.error ? <ErrorState error={dishesQuery.error} /> : null}

      {dishesQuery.data && visible.length === 0 ? (
        <EmptyState
          title="Компонентів не знайдено"
          hint={
            dishesQuery.data.length === 0
              ? 'Довідник порожній. Додайте перший компонент — далі його можна класти в блюдо.'
              : 'Спробуйте інший пошуковий запит.'
          }
        />
      ) : null}

      {visible.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Назва</TableHead>
                <TableHead>Активний</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((dish) => (
                <TableRow key={dish.id} className={dish.is_active ? undefined : 'opacity-60'}>
                  <TableCell className="font-medium">{dish.name}</TableCell>
                  <TableCell>
                    <Switch
                      checked={dish.is_active}
                      aria-label={`Активність компонента ${dish.name}`}
                      disabled={toggleActive.isPending}
                      onCheckedChange={(active) => toggleActive.mutate({ dish, active })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Редагувати ${dish.name}`}
                        onClick={() => openEdit(dish)}
                      >
                        <Pencil className="size-4" aria-hidden />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Видалити ${dish.name}`}
                        onClick={() => setToDelete(dish)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <DishDialog open={dialogOpen} onOpenChange={setDialogOpen} dish={editing} />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Видалити «${toDelete?.name ?? ''}»?`}
        description={
          <>
            Компонент, який уже був у меню, видалити не вийде — на нього спираються
            замовлення. Такий компонент достатньо зробити неактивним: він зникне
            з редактора меню, а історія залишиться цілою.
          </>
        }
        confirmLabel="Видалити"
        destructive
        busy={removeDish.isPending}
        onConfirm={() => toDelete && removeDish.mutate(toDelete)}
      />
    </div>
  )
}
