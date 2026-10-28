import { useEffect, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/** Слово для підтвердження незворотних дій: видалення даних, учня, акаунта. */
export const DELETE_WORD = 'ВИДАЛИТИ'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel = 'Підтвердити',
  cancelLabel = 'Скасувати',
  destructive = false,
  busy = false,
  confirmWord,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: ReactNode
  children?: ReactNode
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  busy?: boolean
  /**
   * Слово, яке треба ввести вручну, перш ніж кнопка стане активною. Для дій,
   * що стирають історію: звичайне «Так» натискають, не читаючи.
   */
  confirmWord?: string
  onConfirm: () => void
}) {
  const [typed, setTyped] = useState('')
  useEffect(() => {
    if (!open) setTyped('')
  }, [open])
  const locked = Boolean(confirmWord) && typed.trim() !== confirmWord

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          {/* Відступ праворуч — під хрестик закриття, інакше довгий заголовок під нього заходить. */}
          <DialogTitle className="pr-6">{title}</DialogTitle>
          {description ? <DialogDescription asChild><div>{description}</div></DialogDescription> : null}
        </DialogHeader>
        {children}
        {confirmWord ? (
          <div className="space-y-2">
            <Label htmlFor="confirm-word">Щоб підтвердити, введіть «{confirmWord}»</Label>
            <Input
              id="confirm-word"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={onConfirm}
            disabled={busy || locked}
          >
            {busy ? 'Виконуємо…' : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
