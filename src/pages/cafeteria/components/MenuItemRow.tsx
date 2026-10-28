import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MenuItemWithDish } from '@/api/menu'

/**
 * Компонент у складі блюда. Ціни в рядку немає: кухар указує одну вартість
 * за все блюдо, а не за кожну складову.
 */
export function MenuItemRow({
  item,
  disabled,
  onRemove,
}: {
  item: MenuItemWithDish
  disabled?: boolean
  onRemove: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.dishes.name}</p>
        {item.dishes.is_active ? null : (
          <p className="text-xs text-muted-foreground">Компонент неактивний у довіднику</p>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Прибрати ${item.dishes.name} з блюда`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
