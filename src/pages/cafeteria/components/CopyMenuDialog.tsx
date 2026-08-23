import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { copyMenu } from '@/api/menu'
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
    mutationFn: () => copyMenu(source, targetDate),
    onSuccess: async (count) => {
      await queryClient.invalidateQueries({ queryKey: ['menu-items'] })
      await queryClient.invalidateQueries({ queryKey: ['menu-day'] })
      await queryClient.invalidateQueries({ queryKey: ['menu-next-empty'] })
      toast.success(count === 0 ? 'У дні-джерелі немає активних страв' : `Скопійовано позицій: ${count}`)
      onOpenChange(false)
    },
    onError: (err) => setError(humanError(err)),
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Скопіювати меню</DialogTitle>
          <DialogDescription>
            Склад меню перенесеться на {formatDateWithWeekday(targetDate)}. Ціни візьмуться
            поточні з довідника, а не ті, що були в дні-джерелі.
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
                У цьому дні вже є страви — вони будуть замінені складом дня-джерела.
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
