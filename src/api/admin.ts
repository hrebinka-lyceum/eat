import { supabase } from '@/lib/supabase'
import { unwrap } from './helpers'
import { humanError } from '@/lib/errors'
import type { Json, PurgePreview, PurgeScope, PurgeLogEntry } from '@/types/database'

/** Переведення року. Незворотна дія, доступна лише суперадміну. */
export async function promoteAcademicYear(newYear: string, startDate?: string): Promise<Json> {
  const { data, error } = await supabase.rpc('promote_academic_year', {
    p_new_year: newYear,
    ...(startDate ? { p_start_date: startDate } : {}),
  })
  if (error) throw new Error(humanError(error, 'Не вдалося перевести навчальний рік.'))
  return data as Json
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
): Promise<Json> {
  const { data, error } = await supabase.rpc('purge_data', {
    p_from: from,
    p_to: to,
    p_scopes: scopes,
    p_confirm: confirm,
  })
  if (error) throw new Error(humanError(error, 'Не вдалося видалити дані.'))
  return data as Json
}

export async function listPurgeLog(): Promise<PurgeLogEntry[]> {
  return unwrap(
    await supabase.from('purge_log').select('*').order('performed_at', { ascending: false }),
    'Не вдалося прочитати журнал видалень.',
  )
}
