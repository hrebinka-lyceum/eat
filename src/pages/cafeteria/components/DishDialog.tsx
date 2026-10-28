import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createDish, updateDish } from '@/api/dishes'
import { humanError } from '@/lib/errors'
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
import { Switch } from '@/components/ui/switch'
import { ErrorState } from '@/components/common/states'
import type { Dish, DishCategory } from '@/types/database'

/**
 * Категорія лишилася в схемі обов'язковим полем, але продукт нею більше не
 * оперує: блюдо складається з довільних компонентів. Пишемо одне й те саме
 * значення й ніде його не показуємо.
 */
const DEFAULT_CATEGORY: DishCategory = 'second'

/**
 * Створення й редагування компонента блюда.
 *
 * Ціни тут немає навмисно: кухар указує одну вартість за все блюдо дня
 * у редакторі меню, а не за кожну складову окремо.
 */
export function DishDialog({
  open,
  onOpenChange,
  dish,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null — створення нового компонента */
  dish: Dish | null
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(dish?.name ?? '')
    setIsActive(dish?.is_active ?? true)
    setError(null)
  }, [open, dish])

  const mutation = useMutation({
    mutationFn: async (payload: { name: string; is_active: boolean }) => {
      if (dish) return updateDish(dish.id, payload)
      return createDish({ ...payload, category: DEFAULT_CATEGORY, price: null })
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['dishes'] })
      toast.success(dish ? `«${saved.name}» збережено` : `«${saved.name}» додано`)
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err)),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Вкажіть назву компонента.')
      return
    }

    mutation.mutate({ name: trimmed, is_active: isActive })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{dish ? 'Редагувати компонент' : 'Новий компонент'}</DialogTitle>
            <DialogDescription>
              Компонент — це складова блюда: гречана каша, котлета, чай, виноград.
              Вартість указується одна на все блюдо в редакторі меню.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dish-name">Назва</Label>
              <Input
                id="dish-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Гречана каша"
                autoFocus
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="dish-active">Активний</Label>
                <p className="text-xs text-muted-foreground">
                  Неактивні компоненти не пропонуються в редакторі меню, але лишаються
                  в уже складених днях.
                </p>
              </div>
              <Switch id="dish-active" checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {error ? <ErrorState error={new Error(error)} /> : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Скасувати
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Зберігаємо…' : 'Зберегти'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
