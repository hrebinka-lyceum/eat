import { addDays, endOfMonth, isWeekend, parseISO, startOfMonth } from 'date-fns'
import { toIsoDate } from './format'

/** Наступний робочий день після вказаного (вихідні пропускаються). */
export function nextWorkday(isoDate: string): string {
  let day = addDays(parseISO(isoDate), 1)
  while (isWeekend(day)) day = addDays(day, 1)
  return toIsoDate(day)
}

/** Попередній робочий день. */
export function prevWorkday(isoDate: string): string {
  let day = addDays(parseISO(isoDate), -1)
  while (isWeekend(day)) day = addDays(day, -1)
  return toIsoDate(day)
}

export function isWeekendIso(isoDate: string): boolean {
  return isWeekend(parseISO(isoDate))
}

export function shiftIso(isoDate: string, days: number): string {
  return toIsoDate(addDays(parseISO(isoDate), days))
}

/** Межі місяця, у якому лежить дата: ['2026-09-01', '2026-09-30'] */
export function monthBounds(isoDate: string): [string, string] {
  const day = parseISO(isoDate)
  return [toIsoDate(startOfMonth(day)), toIsoDate(endOfMonth(day))]
}

/** Межі наступного місяця — типова заготовка для «згенерувати дні». */
export function nextMonthBounds(from: string): [string, string] {
  const day = parseISO(from)
  const next = startOfMonth(addDays(endOfMonth(day), 1))
  return [toIsoDate(next), toIsoDate(endOfMonth(next))]
}

/**
 * Скільки годин лишилось до дедлайну. Використовується ВИКЛЮЧНО для
 * попередження при публікації: рішення, чи приймати замовлення, ухвалює
 * сервер, годинник користувача на нього не впливає.
 */
export function hoursUntil(timestamp: string): number {
  return (new Date(timestamp).getTime() - Date.now()) / 3_600_000
}
