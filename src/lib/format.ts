import { format, parseISO } from 'date-fns'
import { uk } from 'date-fns/locale'
import type { DishCategory, MenuStatus, UserRole } from '@/types/database'

export const TIMEZONE = 'Europe/Kyiv'

export const ROLE_LABELS: Record<UserRole, string> = {
  superadmin: 'Суперадміністратор',
  admin: 'Адміністратор',
  cafeteria: 'Працівник їдальні',
  teacher: 'Класний керівник',
  student: 'Учень',
}

export const CATEGORY_LABELS: Record<DishCategory, string> = {
  first: 'Перша страва',
  second: 'Друга страва',
  side: 'Гарнір',
  drink: 'Напій',
  bakery: 'Випічка',
}

/** Порядок категорій у меню — від першої страви до випічки. */
export const CATEGORY_ORDER: DishCategory[] = ['first', 'second', 'side', 'drink', 'bakery']

export const MENU_STATUS_LABELS: Record<MenuStatus, string> = {
  draft: 'Чернетка',
  published: 'Опубліковано',
  closed: 'Закрито',
}

/** '2026-09-01' -> '1 вересня 2026' */
export function formatDate(isoDate: string): string {
  return format(parseISO(isoDate), 'd MMMM yyyy', { locale: uk })
}

/** '2026-09-01' -> 'пн, 1 вересня' */
export function formatDateWithWeekday(isoDate: string): string {
  return format(parseISO(isoDate), 'EEEEEE, d MMMM', { locale: uk })
}

/** Час дедлайну з timestamptz: '2026-09-01T05:00:00Z' -> '08:00' у Києві */
export function formatCutoffTime(cutoffAt: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(cutoffAt))
}

/** Дедлайн повністю: '1 вересня, 08:00' */
export function formatCutoff(cutoffAt: string): string {
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(cutoffAt))
}

/** Дата у форматі бази: 'YYYY-MM-DD' за київським часом. */
export function toIsoDate(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Сума в гривнях. null означає «сервер не віддав вартість цій ролі» —
 * це нормальний стан, а не помилка, тому просто риска.
 */
export function formatMoney(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency: 'UAH',
    minimumFractionDigits: 2,
  }).format(value)
}

/** Відсоток охоплення; null — коли адміністрація не заповнила розмір класу. */
export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 1 }).format(value)}%`
}

export function fullName(lastName: string, firstName: string): string {
  return `${lastName} ${firstName}`.trim()
}

/**
 * Ціна з поля вводу. Приймає і кому, і крапку; порожнє поле означає
 * «ціни немає» (null), а не нуль — нуль був би справжньою нульовою вартістю.
 */
export function parseMoneyInput(input: string): { value: number | null; error: string | null } {
  const trimmed = input.trim().replace(',', '.')
  if (!trimmed) return { value: null, error: null }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) return { value: null, error: 'Ціна має бути числом.' }
  if (parsed < 0) return { value: null, error: 'Ціна не може бути від’ємною.' }

  return { value: Math.round(parsed * 100) / 100, error: null }
}

/** Значення ціни для поля вводу: null -> порожньо. */
export function moneyToInput(value: number | null | undefined): string {
  return value === null || value === undefined ? '' : String(value)
}
