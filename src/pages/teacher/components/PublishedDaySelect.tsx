import { formatDateWithWeekday } from '@/lib/format'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { MenuDay } from '@/types/database'

export function PublishedDaySelect({
  days,
  value,
  onChange,
  label = 'День',
}: {
  days: MenuDay[]
  value: string | null
  onChange: (date: string) => void
  label?: string
}) {
  if (days.length === 0) return null

  return (
    <div className="w-64 space-y-2">
      <Label htmlFor="day-select">{label}</Label>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger id="day-select" className="w-full">
          <SelectValue placeholder="Оберіть день" />
        </SelectTrigger>
        <SelectContent>
          {days.map((day) => (
            <SelectItem key={day.menu_date} value={day.menu_date}>
              {formatDateWithWeekday(day.menu_date)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
