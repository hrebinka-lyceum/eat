import { supabase } from '@/lib/supabase'
import { fetchAllPages, unwrap } from './helpers'
import type { Gender, PrivilegeLogEntry, Student } from '@/types/database'

// ---------------------------------------------------------------------------
//  Запити для звітів.
//
//  Скрізь, де йдеться про належність замовлення до класу, береться
//  orders.class_id — зліпок на момент замовлення. Учень, переведений у
//  листопаді, має лишатися в жовтневому табелі свого тодішнього класу;
//  students.class_id для цього не годиться, бо він показує «зараз».
// ---------------------------------------------------------------------------

export interface TimesheetOrder {
  menu_date: string
  student_id: string
  privileged_at_order: boolean
  after_cutoff: boolean
  /**
   * null, якщо картка учня недоступна цій ролі. Для керівника так буде з
   * дитиною, яку вже перевели в інший клас: замовлення він бачить, бо в
   * ньому стоїть його клас, а картку — вже ні.
   */
  students: Pick<Student, 'id' | 'last_name' | 'first_name'> | null
}

/** Замовлення класу за період — основа табеля. */
export async function timesheetOrders(
  classId: string,
  from: string,
  to: string,
): Promise<TimesheetOrder[]> {
  return (await fetchAllPages(
    (start, end) =>
      supabase
        .from('orders')
        .select('menu_date, student_id, privileged_at_order, after_cutoff, students(id, last_name, first_name)')
        .eq('class_id', classId)
        .gte('menu_date', from)
        .lte('menu_date', to)
        .order('menu_date')
        .order('id')
        .range(start, end),
    'Не вдалося отримати замовлення для табеля.',
  )) as unknown as TimesheetOrder[]
}

export interface LateOrderRow {
  id: string
  menu_date: string
  created_at: string
  class_id: string
  students: Pick<Student, 'last_name' | 'first_name'> | null
  classes: { name: string } | null
  profiles: { full_name: string } | null
}

/** Замовлення, додані після дедлайну: кухня готувала понад аркуш. */
export async function lateOrders(from: string, to: string): Promise<LateOrderRow[]> {
  return unwrap(
    await supabase
      .from('orders')
      .select(
        'id, menu_date, created_at, class_id, students(last_name, first_name), classes(name), profiles(full_name)',
      )
      .eq('after_cutoff', true)
      .gte('menu_date', from)
      .lte('menu_date', to)
      .order('menu_date', { ascending: false }),
    'Не вдалося отримати пізні замовлення.',
  ) as unknown as LateOrderRow[]
}

export interface PrivilegedStudentRow extends Student {
  classes: { id: string; name: string } | null
}

/** Усі, хто зараз має пільговий статус. */
export async function privilegedStudents(): Promise<PrivilegedStudentRow[]> {
  return unwrap(
    await supabase
      .from('students')
      .select('*, classes(id, name)')
      .eq('is_privileged', true)
      .eq('is_active', true)
      .order('last_name'),
    'Не вдалося отримати список пільговиків.',
  ) as unknown as PrivilegedStudentRow[]
}

export interface PrivilegeLogRow extends PrivilegeLogEntry {
  profiles: { id: string; full_name: string } | null
}

/**
 * Записи журналу пільг для набору учнів. Повертає всі; хто встановив
 * статус останнім, обирає вже екран — так один запит замість тридцяти.
 */
export async function privilegeLogFor(studentIds: string[]): Promise<PrivilegeLogRow[]> {
  if (studentIds.length === 0) return []
  return unwrap(
    await supabase
      .from('privilege_log')
      .select('*, profiles(id, full_name)')
      .in('student_id', studentIds)
      .order('changed_at', { ascending: false }),
    'Не вдалося прочитати журнал пільг.',
  ) as unknown as PrivilegeLogRow[]
}

/** Замовлення для зведених звітів: хто, коли, у якому класі, скільки коштувало. */
export interface MealOrderRow {
  menu_date: string
  student_id: string
  class_id: string
  privileged: boolean
  cost: number
  /** жоден компонент не мав ціни — день без вартості блюда */
  unpriced: boolean
  gender: Gender | null
  /** поточні категорії учня; порожньо — пільга без категорії або без пільги */
  category_ids: string[]
}

/**
 * Усі замовлення періоду разом зі статтю й пільговою категорією учня.
 *
 * Клас і пільга — зліпки з замовлення (orders.class_id, privileged_at_order),
 * а стать і категорія — поточні з картки: історії цих полів немає.
 * Читає сирі price_at_order — викликати лише там, де дозволена вартість.
 */
export async function mealOrders(from: string, to: string): Promise<MealOrderRow[]> {
  const rows = (await fetchAllPages(
    (start, end) =>
      supabase
        .from('orders')
        .select(
          'menu_date, student_id, class_id, privileged_at_order, ' +
            'order_items(price_at_order), students(gender, privilege_category_ids)',
        )
        .gte('menu_date', from)
        .lte('menu_date', to)
        .order('menu_date')
        .order('id')
        .range(start, end),
    'Не вдалося отримати замовлення за період.',
  )) as unknown as Array<{
    menu_date: string
    student_id: string
    class_id: string
    privileged_at_order: boolean
    order_items: Array<{ price_at_order: number | null }>
    students: { gender: Gender | null; privilege_category_ids: string[] | null } | null
  }>

  return rows.map((row) => ({
    menu_date: row.menu_date,
    student_id: row.student_id,
    class_id: row.class_id,
    privileged: row.privileged_at_order,
    cost: row.order_items.reduce((sum, item) => sum + (item.price_at_order ?? 0), 0),
    unpriced: row.order_items.every((item) => item.price_at_order === null),
    gender: row.students?.gender ?? null,
    category_ids: row.students?.privilege_category_ids ?? [],
  }))
}
