import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { copyMenu, listMenuItems, setDayPrice } from '@/api/menu'
import { humanError } from '@/lib/errors'
import { prevWorkday } from '@/lib/dates'
import { formatDateWithWeekday } from '@/lib/format'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ErrorState } from '@/components/common/states'

/** Копіювання складу меню з іншого дня. Ціни беруться поточні з довідника. */
export function CopyMenuDialog({
  open,
  onOpenChange,
  targetDate,
  targetHasItems,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  targetDate: string
  targetHasItems: boolean
}) {
  const queryClient = useQueryClient()
  const [source, setSource] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setSource(prevWorkday(targetDate))
    setError(null)
  }, [open, targetDate])

  const mutation = useMutation({
    mutationFn: async () => {
      // copy_menu бере ціни з довідника, а в компонентів їх немає: вартість
      // належить блюду, а не складовій. Тому переносимо суму дня-джерела
      // самі — інакше скопійований день лишався б без ціни.
      const sourceItems = await listMenuItems(source)
      const sourceTotal = sourceItems.some((item) => item.price !== null)
        ? sourceItems.reduce((sum, item) => sum + (item.price ?? 0), 0)
        : null

      const count = await copyMenu(source, targetDate)
      await setDayPrice(targetDate, sourceTotal)
      return count
    },
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      await queryClient.invalidateQueries({ queryKey: ['menu-day'] })
      await queryClient.invalidateQueries({ queryKey: ['menu-next-empty'] })
      toast.success(
        count === 0
          ? 'У дні-джерелі немає активних компонентів'
          : `Скопійовано компонентів: ${count}`,
      )
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Скопіювати блюдо</DialogTitle>
          <DialogDescription>
            Склад блюда перенесеться на {formatDateWithWeekday(targetDate)} разом
            із вартістю дня-джерела.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="copy-source">З якого дня</Label>
            <Input
              id="copy-source"
              type="date"
              value={source}
              onChange={(e) => setSource(e.target.value)}
            />
          </div>

          {targetHasItems ? (
            <Alert>
              <AlertDescription>
                У цьому дні вже є компоненти — вони будуть замінені складом дня-джерела.
              </AlertDescription>
            </Alert>
          ) : null}

          {error ? <ErrorState error={new Error(error)} /> : null}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Скасувати
          </Button>
          <Button disabled={!source || mutation.isPending} onClick={() => mutation.mutate()}>
            {mutation.isPending ? 'Копіюємо…' : 'Скопіювати'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
