import { supabase } from '@/lib/supabase'
import { unwrap } from './helpers'
import type { Views } from '@/types/database'

/**
 * Представлення зі статистикою. Колонка total_cost приходить як null для
 * ролей без права бачити вартість — це рішення сервера, а не UI.
 */

export async function ordersByDish(
  from: string,
  to: string = from,
): Promise<Views<'v_orders_by_dish'>[]> {
  return unwrap(
    await supabase
      .from('v_orders_by_dish')
      .select('*')
      .gte('menu_date', from)
      .lte('menu_date', to)
      .order('category')
      .order('dish_name'),
    'Не вдалося отримати порції по стравах.',
  )
}

export async function classCoverage(
  from: string,
  to: string = from,
): Promise<Views<'v_class_coverage'>[]> {
  return unwrap(
    await supabase
      .from('v_class_coverage')
      .select('*')
      .gte('menu_date', from)
      .lte('menu_date', to)
      .order('menu_date')
      .order('class_name'),
    'Не вдалося отримати охоплення по класах.',
  )
}

export async function dailyTotals(from: string, to: string): Promise<Views<'v_daily_totals'>[]> {
  return unwrap(
    await supabase
      .from('v_daily_totals')
      .select('*')
      .gte('menu_date', from)
      .lte('menu_date', to)
      .order('menu_date'),
    'Не вдалося отримати підсумки по днях.',
  )
}

/** Атом майбутніх звітів: учень × місяць × днів × сума. */
export async function studentMonths(
  month: string,
  classId?: string,
): Promise<Views<'v_student_month'>[]> {
  let query = supabase.from('v_student_month').select('*').eq('month', month)
  if (classId) query = query.eq('class_id', classId)
  return unwrap(
    await query.order('class_name').order('last_name'),
    'Не вдалося отримати місячну статистику.',
  )
}
