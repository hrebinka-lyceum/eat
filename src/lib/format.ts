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

/**
 * Порядок категорій для показу. Тут навмисно лишаються всі п'ять: гарнір,
 * напій і випічку більше не заводять, але страви минулих років з такими
 * категоріями є в базі, і в меню чи звіті вони мають малюватися, а не
 * тихо зникати.
 */
export const CATEGORY_ORDER: DishCategory[] = ['first', 'second', 'side', 'drink', 'bakery']

/**
 * Категорії, які можна обрати для нової страви.
 *
 * Гарнір, напій і випічка йдуть у комплекті з другою стравою, тож окремими
 * позиціями меню вони більше не є.
 */
export const SELECTABLE_CATEGORIES: DishCategory[] = ['first', 'second']

export const MENU_STATUS_LABELS: Record<MenuStatus, string> = {
  draft: 'Чернетка',
  published: 'Опубліковано',
  closed: 'Закрито',
}

/**
 * Розбір дати з бази. Повертає null для порожнього чи зіпсованого значення,
 * щоб форматування ніколи не кидало RangeError: дата, якої ще немає —
 * звичайний стан (день меню не створено, дедлайн не проставлено), і білого
 * екрана він коштувати не повинен.
 */
function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = parseISO(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Позначка відсутнього значення в інтерфейсі. */
const DASH = '—'

/** '2026-09-01' -> '1 вересня 2026' */
export function formatDate(isoDate: string | null | undefined): string {
  const date = parseDate(isoDate)
  return date ? format(date, 'd MMMM yyyy', { locale: uk }) : DASH
}

/** '2026-09-01' -> 'пн, 1 вересня' */
export function formatDateWithWeekday(isoDate: string | null | undefined): string {
  const date = parseDate(isoDate)
  return date ? format(date, 'EEEEEE, d MMMM', { locale: uk }) : DASH
}

/** Час дедлайну з timestamptz: '2026-09-01T05:00:00Z' -> '08:00' у Києві */
export function formatCutoffTime(cutoffAt: string | null | undefined): string {
  const date = parseDate(cutoffAt)
  if (!date) return DASH
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

/** Дедлайн повністю: '1 вересня о 08:00' */
export function formatCutoff(cutoffAt: string | null | undefined): string {
  const date = parseDate(cutoffAt)
  if (!date) return DASH
  return new Intl.DateTimeFormat('uk-UA', {
    timeZone: TIMEZONE,
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
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

/**
 * Українська множина: 1 позиція, 2 позиції, 5 позицій.
 * Потрібна там, де число підставляється в текст звіту.
 */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod100 = Math.abs(count) % 100
  const mod10 = mod100 % 10
  if (mod100 >= 11 && mod100 <= 14) return many
  if (mod10 === 1) return one
  if (mod10 >= 2 && mod10 <= 4) return few
  return many
}
