import { supabase } from '@/lib/supabase'
import { unwrap } from './helpers'
import { humanError } from '@/lib/errors'
import type { PromoteResult, PurgePreview, PurgeResult, PurgeScope, PurgeLogEntry } from '@/types/database'

/**
 * Переведення року. Незворотна дія, доступна лише суперадміну.
 *
 * `minGrade` — наймолодша паралель школи: саме її добирають новими класами.
 * `maxGrade` — випускна.
 */
export async function promoteAcademicYear(
  newYear: string,
  options: { startDate?: string; minGrade?: number; maxGrade?: number } = {},
): Promise<PromoteResult> {
  // Межі паралелей передаємо завжди. Типові значення функції — 5 і 11; для
  // школи з початковими класами вони створили б другий комплект п'ятих
  // класів поверх уже переведених четвертих і впали б на унікальності.
  const { data, error } = await supabase.rpc('promote_academic_year', {
    p_new_year: newYear,
    ...(options.startDate ? { p_start_date: options.startDate } : {}),
    ...(options.minGrade !== undefined ? { p_min_grade: options.minGrade } : {}),
    ...(options.maxGrade !== undefined ? { p_max_grade: options.maxGrade } : {}),
  })
  if (error) throw new Error(humanError(error, 'Не вдалося перевести навчальний рік.'))
  return data as PromoteResult
}

/** Скільки чого буде видалено. Нічого не видаляє. */
export async function purgePreview(from: string, to: string): Promise<PurgePreview> {
  const { data, error } = await supabase.rpc('purge_preview', { p_from: from, p_to: to })
  if (error) throw new Error(humanError(error, 'Не вдалося порахувати обсяг видалення.'))
  return data as PurgePreview
}

/**
 * Видалення даних за період. Сервер відмовляється чіпати дані свіжіші
 * за 30 днів і вимагає підтвердження словом «ВИДАЛИТИ».
 */
export async function purgeData(
  from: string,
  to: string,
  scopes: PurgeScope[],
  confirm: string,
): Promise<PurgeResult> {
  const { data, error } = await supabase.rpc('purge_data', {
    p_from: from,
    p_to: to,
    p_scopes: scopes,
    p_confirm: confirm,
  })
  if (error) throw new Error(humanError(error, 'Не вдалося видалити дані.'))
  return data as PurgeResult
}

export async function listPurgeLog(): Promise<PurgeLogEntry[]> {
  return unwrap(
    await supabase.from('purge_log').select('*').order('performed_at', { ascending: false }),
    'Не вдалося прочитати журнал видалень.',
  )
}
