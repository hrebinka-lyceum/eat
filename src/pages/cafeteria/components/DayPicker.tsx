import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateWithWeekday, toIsoDate } from '@/lib/format'
import { isWeekendIso, nextWorkday, prevWorkday } from '@/lib/dates'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

/**
 * Перемикач дня. Стрілки ходять по робочих днях — вихідних у меню немає,
 * але вручну ввести будь-яку дату не заважаємо.
 */
export function DayPicker({
  value,
  onChange,
}: {
  value: string
  onChange: (date: string) => void
}) {
  const today = toIsoDate()

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        aria-label="Попередній робочий день"
        onClick={() => onChange(prevWorkday(value))}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </Button>

      <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5">
        <CalendarDays className="size-4 text-muted-foreground" aria-hidden />
        <span className="min-w-40 text-sm font-medium">{formatDateWithWeekday(value)}</span>
      </div>

      <Button
        variant="outline"
        size="icon"
        aria-label="Наступний робочий день"
        onClick={() => onChange(nextWorkday(value))}
      >
        <ChevronRight className="size-4" aria-hidden />
      </Button>

      <Input
        type="date"
        className="w-40"
        aria-label="Обрати дату"
        value={value}
        onChange={(e) => e.target.value && onChange(e.target.value)}
      />

      {value !== today ? (
        <Button variant="ghost" size="sm" onClick={() => onChange(today)}>
          Сьогодні
        </Button>
      ) : null}

      {isWeekendIso(value) ? (
        <span className="text-xs text-muted-foreground">Вихідний день</span>
      ) : null}
    </div>
  )
}
