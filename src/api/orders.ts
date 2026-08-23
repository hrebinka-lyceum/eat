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
 * Для пільгового учня p_menu_item_ids ігнорується: комплекс покладений повністю.
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
