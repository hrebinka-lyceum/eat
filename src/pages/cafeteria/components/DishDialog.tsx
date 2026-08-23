import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createDish, updateDish } from '@/api/dishes'
import { humanError } from '@/lib/errors'
import { CATEGORY_LABELS, CATEGORY_ORDER, moneyToInput, parseMoneyInput } from '@/lib/format'
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
import { Switch } from '@/components/ui/switch'
import { ErrorState } from '@/components/common/states'
import type { Dish, DishCategory } from '@/types/database'

/** Створення й редагування страви. Ціна — собівартість порції для школи. */
export function DishDialog({
  open,
  onOpenChange,
  dish,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** null — створення нової страви */
  dish: Dish | null
}) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [category, setCategory] = useState<DishCategory>('first')
  const [price, setPrice] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(dish?.name ?? '')
    setCategory(dish?.category ?? 'first')
    setPrice(moneyToInput(dish?.price))
    setIsActive(dish?.is_active ?? true)
    setError(null)
  }, [open, dish])

  const mutation = useMutation({
    mutationFn: async (payload: {
      name: string
      category: DishCategory
      price: number | null
      is_active: boolean
    }) => {
      if (dish) return updateDish(dish.id, payload)
      return createDish(payload)
    },
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['dishes'] })
      toast.success(dish ? `Страву «${saved.name}» збережено` : `Страву «${saved.name}» додано`)
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err)),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const trimmed = name.trim()
    if (!trimmed) {
      setError('Вкажіть назву страви.')
      return
    }

    const parsed = parseMoneyInput(price)
    if (parsed.error) {
      setError(parsed.error)
      return
    }

    mutation.mutate({ name: trimmed, category, price: parsed.value, is_active: isActive })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>{dish ? 'Редагувати страву' : 'Нова страва'}</DialogTitle>
            <DialogDescription>
              Ціна — собівартість порції для школи. Вона автоматично підставляється
              в меню, але для конкретного дня її можна перевизначити.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dish-name">Назва</Label>
              <Input
                id="dish-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Борщ український"
                autoFocus
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="dish-category">Категорія</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as DishCategory)}>
                <SelectTrigger id="dish-category" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_ORDER.map((item) => (
                    <SelectItem key={item} value={item}>
                      {CATEGORY_LABELS[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dish-price">Ціна, ₴</Label>
              <Input
                id="dish-price"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="Не вказано"
              />
              <p className="text-xs text-muted-foreground">
                Можна лишити порожнім — тоді страва потрапить у меню без ціни.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="dish-active">Активна</Label>
                <p className="text-xs text-muted-foreground">
                  Неактивні страви не пропонуються в редакторі меню, але лишаються
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
