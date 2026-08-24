// ---------------------------------------------------------------------------
//  Універсальний експорт у CSV.
//
//  Бухгалтерія й управління освіти працюють з файлами, тож кнопка експорту
//  має бути біля кожної таблиці й дашборда. Ця утиліта — основа майбутніх
//  звітів, тому вона нічого не знає про конкретні екрани.
// ---------------------------------------------------------------------------

export interface CsvColumn<T> {
  /** Заголовок стовпця українською */
  header: string
  /** Значення комірки; undefined і null стають порожньою коміркою */
  value: (row: T) => string | number | boolean | null | undefined
}

function cell(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return ''
  const text = typeof value === 'boolean' ? (value ? 'так' : 'ні') : String(value)
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * Складає текст CSV. Винесено окремо від завантаження, щоб екранування
 * можна було перевірити тестом, не імітуючи браузер.
 *
 * Роздільник — крапка з комою: Excel з українською локаллю відкриває такий
 * файл без «майстра імпорту». BOM — щоб кирилиця не перетворилась на кракозябри.
 */
export function buildCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => cell(c.header)).join(';')
  const body = rows.map((row) => columns.map((c) => cell(c.value(row))).join(';'))
  return '\ufeff' + [header, ...body].join('\r\n') + '\r\n'
}

/** Формує CSV і віддає його користувачу як файл. */
export function exportToCsv<T>(rows: T[], columns: CsvColumn<T>[], filename: string): void {
  const blob = new Blob([buildCsv(rows, columns)], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

/** Ім'я файлу з датою: «порції-2026-09-01.csv» */
export function csvFilename(prefix: string, suffix?: string): string {
  const stamp = suffix ?? new Date().toISOString().slice(0, 10)
  return `${prefix}-${stamp}.csv`
}
