import { addDays, endOfMonth, format, isWeekend, parseISO, startOfMonth } from 'date-fns'
import { uk } from 'date-fns/locale'
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

/** Значення для <input type="month"> — 'YYYY-MM' за київським часом. */
export function toMonthValue(isoDate: string = toIsoDate()): string {
  return isoDate.slice(0, 7)
}

/** 'YYYY-MM' -> межі місяця ['2026-09-01', '2026-09-30'] */
export function monthValueBounds(month: string): [string, string] {
  return monthBounds(`${month}-01`)
}

/** 'YYYY-MM' -> 'вересень 2026' */
export function formatMonthValue(month: string): string {
  return format(parseISO(`${month}-01`), 'LLLL yyyy', { locale: uk })
}
