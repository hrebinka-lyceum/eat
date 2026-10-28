import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from './helpers'
import type { ReportSettings } from '@/types/database'

/** Хто затверджує звіти. Рядок один; поки міграції немає — null. */
export async function getReportSettings(): Promise<ReportSettings | null> {
  const result = await supabase.from('report_settings').select('*').eq('id', true).maybeSingle()
  // Таблиці ще немає (міграцію не виконали): звіт має формуватися й так,
  // просто без імені директора.
  if (result.error && ['PGRST205', '42P01'].includes(result.error.code)) return null
  return unwrapMaybe(result, 'Не вдалося прочитати налаштування звітів.')
}

export async function updateDirector(lastName: string, firstName: string): Promise<ReportSettings> {
  return unwrap(
    await supabase
      .from('report_settings')
      .update({ director_last_name: lastName.trim(), director_first_name: firstName.trim() })
      .eq('id', true)
      .select('*')
      .single(),
    'Не вдалося зберегти ім’я директора.',
  )
}
