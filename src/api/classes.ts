import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from './helpers'
import type { Class, TablesInsert, TablesUpdate } from '@/types/database'

export async function listClasses(academicYear?: string): Promise<Class[]> {
  let query = supabase.from('classes').select('*').order('name')
  if (academicYear) query = query.eq('academic_year', academicYear)
  return unwrap(await query, 'Не вдалося отримати список класів.')
}

export async function getClass(classId: string): Promise<Class | null> {
  return unwrapMaybe(
    await supabase.from('classes').select('*').eq('id', classId).maybeSingle(),
    'Не вдалося прочитати клас.',
  )
}

/** Клас, яким керує цей користувач у вказаному навчальному році. */
export async function getClassOfTeacher(
  teacherId: string,
  academicYear: string,
): Promise<Class | null> {
  return unwrapMaybe(
    await supabase
      .from('classes')
      .select('*')
      .eq('teacher_id', teacherId)
      .eq('academic_year', academicYear)
      .maybeSingle(),
    'Не вдалося визначити ваш клас.',
  )
}

export async function createClass(payload: TablesInsert<'classes'>): Promise<Class> {
  return unwrap(
    await supabase.from('classes').insert(payload).select('*').single(),
    'Не вдалося створити клас.',
  )
}

export async function updateClass(classId: string, patch: TablesUpdate<'classes'>): Promise<Class> {
  return unwrap(
    await supabase.from('classes').update(patch).eq('id', classId).select('*').single(),
    'Не вдалося зберегти зміни в класі.',
  )
}

/** Розмір класу; без нього coverage_class_pct залишається порожнім. */
export async function setTotalStudents(classId: string, total: number | null): Promise<Class> {
  return updateClass(classId, { total_students: total })
}

export async function setClassTeacher(classId: string, teacherId: string | null): Promise<Class> {
  return updateClass(classId, { teacher_id: teacherId })
}

export async function deleteClass(classId: string): Promise<void> {
  const { error } = await supabase.from('classes').delete().eq('id', classId)
  if (error) throw new Error('Не вдалося видалити клас — можливо, в ньому ще є учні.')
}
