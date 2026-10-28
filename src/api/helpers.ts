import type { PostgrestError } from '@supabase/supabase-js'
import { humanError } from '@/lib/errors'

/**
 * Розпаковує відповідь Supabase: дані або зрозуміла людині помилка.
 * Увесь шар api/ кидає саме Error з готовим текстом, тож компонентам
 * не доводиться знати про коди Postgres.
 */
export function unwrap<T>(
  result: { data: T | null; error: PostgrestError | null },
  fallback?: string,
): T {
  if (result.error) throw new Error(humanError(result.error, fallback))
  return result.data as T
}

/** Те саме для запитів, де порожній результат — нормальний стан. */
export function unwrapMaybe<T>(
  result: { data: T | null; error: PostgrestError | null },
  fallback?: string,
): T | null {
  if (result.error) throw new Error(humanError(result.error, fallback))
  return result.data
}

/** Екранує символи, які в ilike означають шаблон. */
export function likeEscape(term: string): string {
  return term.replace(/[%_\\]/g, (m) => `\\${m}`)
}

/**
 * Читає всі сторінки запиту.
 *
 * Supabase за замовчуванням віддає не більше 1000 рядків, і без пагінації
 * місяць замовлень школи (кілька тисяч) мовчки обрізався б — звіт про
 * відшкодування рахував би лише першу тисячу.
 *
 * Зсуваємося на кількість фактично отриманих рядків і зупиняємося на
 * порожній сторінці: якщо ліміт сервера менший за PAGE_SIZE, крок у
 * PAGE_SIZE перестрибнув би частину рядків. Запит мусить мати стабільний
 * порядок (order по унікальному ключу), інакше сторінки перекриваються.
 */
export const PAGE_SIZE = 1000

export async function fetchAllPages<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: PostgrestError | null }>,
  fallback?: string,
): Promise<T[]> {
  const all: T[] = []
  for (;;) {
    const rows = unwrap(await page(all.length, all.length + PAGE_SIZE - 1), fallback) ?? []
    if (rows.length === 0) return all
    all.push(...rows)
  }
}
