import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { exportToCsv, type CsvColumn } from '@/lib/csv'

/**
 * Кнопка експорту. Стоїть біля кожної таблиці й дашборда: бухгалтерія
 * й управління освіти працюють тільки з файлами.
 */
export function ExportButton<T>({
  rows,
  columns,
  filename,
  label = 'Експорт CSV',
  disabled,
}: {
  rows: T[]
  columns: CsvColumn<T>[]
  filename: string
  label?: string
  disabled?: boolean
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || rows.length === 0}
      onClick={() => exportToCsv(rows, columns, filename)}
    >
      <Download className="size-4" aria-hidden />
      {label}
    </Button>
  )
}
