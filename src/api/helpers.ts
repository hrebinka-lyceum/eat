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
