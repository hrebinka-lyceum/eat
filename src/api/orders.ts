import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from './helpers'
import { humanError } from '@/lib/errors'
import type { Dish, MenuItem, Order, OrderItem } from '@/types/database'

export interface OrderWithItems extends Order {
  order_items: Array<
    OrderItem & {
      menu_items: (Pick<MenuItem, 'id' | 'dish_id'> & {
        dishes: Pick<Dish, 'id' | 'name' | 'category'>
      }) | null
    }
  >
}

const WITH_ITEMS = '*, order_items(*, menu_items(id, dish_id, dishes(id, name, category)))'

/**
 * Єдиний спосіб створити замовлення. Дедлайн і права перевіряє сервер —
 * годинник клієнта тут ні на що не впливає.
 *
 * Страви обирають усі однаково, зокрема пільгові учні: пільга визначає, хто
 * платить, а не що подають. Сервер зберігає її як зліпок privileged_at_order —
 * саме на ньому будується звіт про відшкодування.
 */
export async function placeOrder(
  studentId: string,
  menuDate: string,
  menuItemIds: string[],
): Promise<string> {
  const { data, error } = await supabase.rpc('place_order', {
    p_student_id: studentId,
    p_menu_date: menuDate,
    p_menu_item_ids: menuItemIds,
  })
  if (error) throw new Error(humanError(error, 'Не вдалося зробити замовлення.'))
  return data as string
}

export async function getOrderOfStudent(
  studentId: string,
  menuDate: string,
): Promise<OrderWithItems | null> {
  return unwrapMaybe(
    await supabase
      .from('orders')
      .select(WITH_ITEMS)
      .eq('student_id', studentId)
      .eq('menu_date', menuDate)
      .maybeSingle(),
    'Не вдалося прочитати замовлення.',
  ) as unknown as OrderWithItems | null
}

export async function listOrdersOfStudent(studentId: string, limit = 60): Promise<OrderWithItems[]> {
  return unwrap(
    await supabase
      .from('orders')
      .select(WITH_ITEMS)
      .eq('student_id', studentId)
      .order('menu_date', { ascending: false })
      .limit(limit),
    'Не вдалося отримати історію замовлень.',
  ) as unknown as OrderWithItems[]
}

export async function listOrdersOfClass(classId: string, menuDate: string): Promise<Order[]> {
  return unwrap(
    await supabase.from('orders').select('*').eq('class_id', classId).eq('menu_date', menuDate),
    'Не вдалося отримати замовлення класу.',
  )
}

export async function listOrdersOfDay(menuDate: string): Promise<OrderWithItems[]> {
  return unwrap(
    await supabase.from('orders').select(WITH_ITEMS).eq('menu_date', menuDate).order('class_id'),
    'Не вдалося отримати замовлення на день.',
  ) as unknown as OrderWithItems[]
}

/** Скасування — єдина зміна замовлення, і лише в адміністрації. */
export async function cancelOrder(orderId: string): Promise<void> {
  const { error } = await supabase.from('orders').delete().eq('id', orderId)
  if (error) throw new Error(humanError(error, 'Не вдалося скасувати замовлення.'))
}

// ---------------------------------------------------------------------------
//  Варіанти без цін — для екранів учня та класного керівника.
//
//  order_items.price_at_order сервер віддає власнику замовлення й керівнику
//  класу: фільтрації вартості там немає, вона є лише у представленнях.
//  Тому ціну просто не запитуємо — так її неможливо показати помилково.
// ---------------------------------------------------------------------------

export interface OrderPlain {
  id: string
  menu_date: string
  student_id: string
  class_id: string
  privileged_at_order: boolean
  after_cutoff: boolean
  created_at: string
  order_items: Array<{
    id: string
    menu_items: { id: string; dishes: Pick<Dish, 'id' | 'name' | 'category'> } | null
  }>
}

const PLAIN_COLUMNS =
  'id, menu_date, student_id, class_id, privileged_at_order, after_cutoff, created_at, ' +
  'order_items(id, menu_items(id, dishes(id, name, category)))'

export async function getOrderPlain(
  studentId: string,
  menuDate: string,
): Promise<OrderPlain | null> {
  return unwrapMaybe(
    await supabase
      .from('orders')
      .select(PLAIN_COLUMNS)
      .eq('student_id', studentId)
      .eq('menu_date', menuDate)
      .maybeSingle(),
    'Не вдалося прочитати замовлення.',
  ) as unknown as OrderPlain | null
}

export async function listOrdersPlainOfStudent(
  studentId: string,
  limit = 60,
): Promise<OrderPlain[]> {
  return unwrap(
    await supabase
      .from('orders')
      .select(PLAIN_COLUMNS)
      .eq('student_id', studentId)
      .order('menu_date', { ascending: false })
      .limit(limit),
    'Не вдалося отримати історію замовлень.',
  ) as unknown as OrderPlain[]
}

/** Замовлення класу на день зі складом, але без цін. */
export async function listOrdersPlainOfClass(
  classId: string,
  menuDate: string,
): Promise<OrderPlain[]> {
  return unwrap(
    await supabase
      .from('orders')
      .select(PLAIN_COLUMNS)
      .eq('class_id', classId)
      .eq('menu_date', menuDate),
    'Не вдалося отримати замовлення класу.',
  ) as unknown as OrderPlain[]
}
