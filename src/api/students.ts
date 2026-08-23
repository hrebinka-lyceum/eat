import { supabase } from '@/lib/supabase'
import { likeEscape, unwrap, unwrapMaybe } from './helpers'
import { humanError } from '@/lib/errors'
import type {
  ClassEnrollment,
  PrivilegeLogEntry,
  Student,
  TablesInsert,
  TablesUpdate,
} from '@/types/database'

export interface StudentWithClass extends Student {
  classes: { id: string; name: string } | null
  profiles: { id: string; full_name: string; status: string } | null
}

const WITH_RELATIONS = '*, classes(id, name), profiles(id, full_name, status)'

/**
 * Реєстр класу — лише ті, хто харчується. Це не список класу:
 * скільки дітей у класі загалом, знає classes.total_students.
 */
export async function listStudentsOfClass(
  classId: string,
  opts: { includeInactive?: boolean } = {},
): Promise<Student[]> {
  let query = supabase.from('students').select('*').eq('class_id', classId)
  if (!opts.includeInactive) query = query.eq('is_active', true)
  return unwrap(
    await query.order('last_name').order('first_name'),
    'Не вдалося отримати список учнів.',
  )
}

/** Пошук по прізвищу або імені. RLS сама звузить видиме до прав ролі. */
export async function searchStudents(
  term: string,
  opts: { limit?: number; includeInactive?: boolean } = {},
): Promise<StudentWithClass[]> {
  const safe = likeEscape(term.trim())
  if (!safe) return []
  let query = supabase.from('students').select(WITH_RELATIONS)
  if (!opts.includeInactive) query = query.eq('is_active', true)
  return unwrap(
    await query
      .or(`last_name.ilike.%${safe}%,first_name.ilike.%${safe}%`)
      .order('last_name')
      .limit(opts.limit ?? 50),
    'Пошук не вдався.',
  ) as unknown as StudentWithClass[]
}

export async function getStudent(studentId: string): Promise<StudentWithClass | null> {
  return unwrapMaybe(
    await supabase.from('students').select(WITH_RELATIONS).eq('id', studentId).maybeSingle(),
    'Не вдалося прочитати картку учня.',
  ) as unknown as StudentWithClass | null
}

/** Учень, прив'язаний до цього акаунта. null — акаунт не учнівський. */
export async function getStudentByProfile(profileId: string): Promise<Student | null> {
  return unwrapMaybe(
    await supabase.from('students').select('*').eq('profile_id', profileId).maybeSingle(),
    'Не вдалося знайти вашу картку учня.',
  )
}

export async function createStudent(payload: TablesInsert<'students'>): Promise<Student> {
  return unwrap(
    await supabase.from('students').insert(payload).select('*').single(),
    'Не вдалося додати учня.',
  )
}

export async function updateStudent(
  studentId: string,
  patch: TablesUpdate<'students'>,
): Promise<Student> {
  return unwrap(
    await supabase.from('students').update(patch).eq('id', studentId).select('*').single(),
    'Не вдалося зберегти зміни.',
  )
}

/** Кожна зміна пільги лишає слід у privilege_log — це робить тригер. */
export async function setPrivilege(
  studentId: string,
  isPrivileged: boolean,
  note: string | null,
): Promise<Student> {
  return updateStudent(studentId, { is_privileged: isPrivileged, privilege_note: note })
}

/** Хто і коли востаннє змінював пільговий статус. */
export async function getPrivilegeLog(
  studentId: string,
  limit = 5,
): Promise<PrivilegeLogEntry[]> {
  return unwrap(
    await supabase
      .from('privilege_log')
      .select('*')
      .eq('student_id', studentId)
      .order('changed_at', { ascending: false })
      .limit(limit),
    'Не вдалося прочитати журнал пільг.',
  )
}

export async function getEnrollments(studentId: string): Promise<ClassEnrollment[]> {
  return unwrap(
    await supabase
      .from('class_enrollments')
      .select('*')
      .eq('student_id', studentId)
      .order('from_date', { ascending: false }),
    'Не вдалося прочитати історію класів.',
  )
}

/** Переведення в інший клас. Історію веде функція, не клієнт. */
export async function transferStudent(
  studentId: string,
  newClassId: string,
  fromDate?: string,
): Promise<void> {
  const { error } = await supabase.rpc('transfer_student', {
    p_student_id: studentId,
    p_new_class_id: newClassId,
    ...(fromDate ? { p_from_date: fromDate } : {}),
  })
  if (error) throw new Error(humanError(error, 'Не вдалося перевести учня.'))
}
