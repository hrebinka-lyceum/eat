import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { moneyToInput, parseMoneyInput } from '@/lib/format'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MenuItemWithDish } from '@/api/menu'

/**
 * Рядок меню на день. Ціна редагується просто тут: ціна продуктів стрибає,
 * і працівник їдальні має вміти відобразити це для конкретного дня, не
 * чіпаючи довідник.
 */
export function MenuItemRow({
  item,
  disabled,
  onPriceChange,
  onRemove,
}: {
  item: MenuItemWithDish
  disabled?: boolean
  onPriceChange: (price: number | null) => void
  onRemove: () => void
}) {
  const [price, setPrice] = useState(moneyToInput(item.price))
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setPrice(moneyToInput(item.price))
  }, [item.price])

  const commit = () => {
    const parsed = parseMoneyInput(price)
    if (parsed.error) {
      setError(parsed.error)
      return
    }
    setError(null)
    if (parsed.value !== item.price) onPriceChange(parsed.value)
  }

  return (
    <div className="flex items-center gap-3 rounded-md border px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{item.dishes.name}</p>
        {item.dishes.is_active ? null : (
          <p className="text-xs text-muted-foreground">Страва неактивна в довіднику</p>
        )}
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>

      <div className="flex items-center gap-1">
        <Input
          className="w-24 text-right tabular-nums"
          inputMode="decimal"
          aria-label={`Ціна на цей день: ${item.dishes.name}`}
          placeholder="—"
          value={price}
          disabled={disabled}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
          }}
        />
        <span className="text-sm text-muted-foreground">₴</span>
      </div>

      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Прибрати ${item.dishes.name} з меню`}
        disabled={disabled}
        onClick={onRemove}
      >
        <Trash2 className="size-4" aria-hidden />
      </Button>
    </div>
  )
}
