import { supabase } from '@/lib/supabase'
import { unwrap } from './helpers'
import type { PrivilegeLogEntry, Student } from '@/types/database'

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
  return unwrap(
    await supabase
      .from('orders')
      .select('menu_date, student_id, privileged_at_order, after_cutoff, students(id, last_name, first_name)')
      .eq('class_id', classId)
      .gte('menu_date', from)
      .lte('menu_date', to)
      .order('menu_date'),
    'Не вдалося отримати замовлення для табеля.',
  ) as unknown as TimesheetOrder[]
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
