import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { generateMenuDays } from '@/api/menu'
import { humanError } from '@/lib/errors'
import { nextMonthBounds } from '@/lib/dates'
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

/** Створення чернеток днів меню на робочі дні періоду. */
export function GenerateDaysDialog({
  open,
  onOpenChange,
  anchorDate,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Від якої дати рахувати «наступний місяць» */
  anchorDate: string
}) {
  const queryClient = useQueryClient()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    const [start, end] = nextMonthBounds(anchorDate)
    setFrom(start)
    setTo(end)
    setError(null)
  }, [open, anchorDate])

  const mutation = useMutation({
    mutationFn: () => generateMenuDays(from, to),
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: ['menu-days'] })
      await queryClient.invalidateQueries({ queryKey: ['menu-day'] })
      await queryClient.invalidateQueries({ queryKey: ['menu-next-empty'] })
      toast.success(
        count === 0
          ? 'Нових днів не з’явилось — усі робочі дні періоду вже створені'
          : `Створено днів: ${count}`,
      )
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Згенерувати дні меню</DialogTitle>
          <DialogDescription>
            Створюються чернетки на робочі дні періоду. Вихідні пропускаються,
            уже наявні дні не чіпаються. Свята й канікули доведеться зняти вручну —
            виробничого календаря в системі немає.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="gen-from">З дати</Label>
            <Input id="gen-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="gen-to">По дату</Label>
            <Input id="gen-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {error ? (
            <div className="sm:col-span-2">
              <ErrorState error={new Error(error)} />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button disabled={!from || !to || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Створюємо…' : 'Створити дні'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
