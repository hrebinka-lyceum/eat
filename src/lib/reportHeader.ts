import { SCHOOL_NAME } from './school'

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
    // Назва закладу вже відома — підставляємо її, поки не змінили вручну.
    return localStorage.getItem(STORAGE_KEY) ?? SCHOOL_NAME
  } catch {
    // Приватний режим або заборонене сховище — працюємо без збереження.
    return SCHOOL_NAME
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
