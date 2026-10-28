import { supabase } from '@/lib/supabase'
import { likeEscape, unwrap, unwrapMaybe } from './helpers'
import { humanError, humanErrorWith } from '@/lib/errors'
import type {
  ClassEnrollment,
  Gender,
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

/**
 * Пільга учня: «без пільги», категорія зі списку або пільга без категорії
 * (так позначені всі, кому її ставили до появи категорій).
 */
export type PrivilegeChoice =
  | { kind: 'none' }
  | { kind: 'category'; categoryId: string }
  | { kind: 'uncategorized' }

export function privilegeChoiceOf(student: Pick<Student, 'is_privileged' | 'privilege_category_id'>): PrivilegeChoice {
  if (!student.is_privileged) return { kind: 'none' }
  return student.privilege_category_id
    ? { kind: 'category', categoryId: student.privilege_category_id }
    : { kind: 'uncategorized' }
}

/** Поля пільги для запису. Категорія без is_privileged заборонена в базі. */
export function privilegeFields(choice: PrivilegeChoice) {
  switch (choice.kind) {
    case 'none':
      return { is_privileged: false, privilege_category_id: null }
    case 'category':
      return { is_privileged: true, privilege_category_id: choice.categoryId }
    case 'uncategorized':
      return { is_privileged: true, privilege_category_id: null }
  }
}

export interface StudentProfilePatch {
  lastName: string
  firstName: string
  gender: Gender | null
  privilege: PrivilegeChoice
}

/**
 * Профіль учня одним записом. Кожна зміна is_privileged лишає слід у
 * privilege_log — це робить тригер; зміну категорії журнал не бачить.
 */
export async function updateStudentProfile(
  studentId: string,
  patch: StudentProfilePatch,
): Promise<Student> {
  return updateStudent(studentId, {
    last_name: patch.lastName.trim(),
    first_name: patch.firstName.trim(),
    gender: patch.gender,
    ...privilegeFields(patch.privilege),
  })
}

/** Скільки замовлень в учня і за який період — те, що зникне при повному видаленні. */
export interface StudentOrderSummary {
  count: number
  first: string | null
  last: string | null
}

export async function studentOrderSummary(studentId: string): Promise<StudentOrderSummary> {
  const fallback = 'Не вдалося перевірити замовлення учня.'
  const [counted, first, last] = await Promise.all([
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('student_id', studentId),
    supabase.from('orders').select('menu_date').eq('student_id', studentId).order('menu_date').limit(1).maybeSingle(),
    supabase
      .from('orders')
      .select('menu_date')
      .eq('student_id', studentId)
      .order('menu_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])
  if (counted.error) throw new Error(humanError(counted.error, fallback))
  return {
    count: counted.count ?? 0,
    first: unwrapMaybe(first, fallback)?.menu_date ?? null,
    last: unwrapMaybe(last, fallback)?.menu_date ?? null,
  }
}

/**
 * Видалення учня разом з його акаунтом.
 *
 * Прямий delete заборонений не випадково: orders.student_id стоїть
 * ON DELETE CASCADE, і разом з учнем зникла б уся історія харчування.
 * Без `force` сервер видаляє лише учня без замовлень. З `force` — будь-якого,
 * але тільки для суперадміна, і запис про це лишається в журналі видалень.
 */
export async function deleteStudent(
  studentId: string,
  { force = false }: { force?: boolean } = {},
): Promise<{ accountNote: string | null }> {
  // p_force лише коли потрібен: так звичайне видалення працює й на сервері,
  // де ще немає версії функції з цим параметром.
  const { data, error } = await supabase.rpc('delete_student', {
    p_student_id: studentId,
    ...(force ? { p_force: true } : {}),
  })
  if (error) {
    throw new Error(
      humanErrorWith(
        error,
        {
          '23503':
            'Учень уже має замовлення, тому видалити його не можна — зникла б історія ' +
            'харчування і звіти за минулі місяці. Позначте «Більше не харчується».',
          '42501': 'Учня з історією замовлень може видалити лише суперадміністратор.',
          PGRST202: force
            ? 'Повне видалення учнів ще не налаштоване на сервері — потрібна міграція бази.'
            : 'Видалення учнів ще не налаштоване на сервері. Зверніться до адміністратора системи.',
        },
        'Не вдалося видалити учня.',
      ),
    )
  }
  return { accountNote: data?.account_note ?? null }
}

/** Хто і коли востаннє змінював пільговий статус. */
export interface PrivilegeLogRow extends PrivilegeLogEntry {
  /**
   * Ім'я того, хто змінив статус. null, якщо це зробив користувач, чий
   * профіль поточній ролі не видно — наприклад, адміністратор для
   * класного керівника. Це нормально: політика profiles показує керівнику
   * лише його самого та учнів його класу.
   */
  profiles: { id: string; full_name: string } | null
}

export async function getPrivilegeLog(studentId: string, limit = 5): Promise<PrivilegeLogRow[]> {
  return unwrap(
    await supabase
      .from('privilege_log')
      .select('*, profiles(id, full_name)')
      .eq('student_id', studentId)
      .order('changed_at', { ascending: false })
      .limit(limit),
    'Не вдалося прочитати журнал пільг.',
  ) as unknown as PrivilegeLogRow[]
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

/**
 * Учень більше не харчується. Рядок і вся історія лишаються: is_active
 * знімає його з реєстру, left_at каже, з якого дня його не рахувати
 * в охопленні.
 */
export async function retireStudent(studentId: string, leftAt: string): Promise<Student> {
  return updateStudent(studentId, { is_active: false, left_at: leftAt })
}

/** Повернути учня в реєстр. */
export async function restoreStudent(studentId: string): Promise<Student> {
  return updateStudent(studentId, { is_active: true, left_at: null })
}
