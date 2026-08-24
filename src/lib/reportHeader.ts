const STORAGE_KEY = 'eat.report-header'

/**
 * Заголовок для друку — назва закладу в шапці аркуша.
 *
 * Тримаємо в браузері, а не в базі: назви школи в схемі немає, а додавати
 * туди колонку заради одного рядка на папері не варто. Кожен, хто друкує,
 * вписує його раз — і воно лишається на цьому комп'ютері.
 */
export function readReportHeader(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? ''
  } catch {
    // Приватний режим або заборонене сховище — просто працюємо без заголовка.
    return ''
  }
}

export function writeReportHeader(value: string): void {
  try {
    if (value.trim()) localStorage.setItem(STORAGE_KEY, value.trim())
    else localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Не вдалося зберегти — не привід ламати друк.
  }
}
