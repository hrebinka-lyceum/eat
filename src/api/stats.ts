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

export interface OrderCostRow {
  menu_date: string
  class_id: string
  privileged: boolean
  cost: number
}

/**
 * Вартість замовлень із розрізненням «пільгові / звичайні».
 *
 * Представлення такого розрізу не дають: v_daily_totals ділить за ознакою
 * лише кількість замовлень, а не суму. Тому беремо зліпки цін із
 * order_items разом з ознакою orders.privileged_at_order — це точні дані
 * на момент замовлення, саме те, на що спирається звіт про відшкодування.
 *
 * ⚠ Тут читаються сирі price_at_order, які сервер не фільтрує за роллю.
 * Викликати лише там, де вартість дозволена: canSeeCost().
 */
export async function costRows(from: string, to: string): Promise<OrderCostRow[]> {
  const rows = unwrap(
    await supabase
      .from('orders')
      .select('menu_date, class_id, privileged_at_order, order_items(price_at_order)')
      .gte('menu_date', from)
      .lte('menu_date', to)
      .order('menu_date'),
    'Не вдалося порахувати вартість.',
  ) as unknown as Array<{
    menu_date: string
    class_id: string
    privileged_at_order: boolean
    order_items: Array<{ price_at_order: number | null }>
  }>

  return rows.map((row) => ({
    menu_date: row.menu_date,
    class_id: row.class_id,
    privileged: row.privileged_at_order,
    // null у ціні — страва без ціни в довіднику, а не нуль-вартість.
    // Для суми вона просто нічого не додає.
    cost: row.order_items.reduce((sum, item) => sum + (item.price_at_order ?? 0), 0),
  }))
}
