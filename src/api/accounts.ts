import { FunctionsFetchError, FunctionsHttpError, FunctionsRelayError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

// ---------------------------------------------------------------------------
//  Edge Function `accounts` — єдина точка керування акаунтами.
//
//  ⚠ Паролі повертаються рівно один раз і ніде не зберігаються: ні в базі,
//  ні в кеші запитів, ні в localStorage. Показати їх треба одразу, інакше
//  залишиться тільки скинути наново.
//
//  Виклик через functions.invoke: токен сесії підставляється автоматично,
//  тож заголовок Authorization не доводиться збирати вручну.
// ---------------------------------------------------------------------------

export interface IssuedLogin {
  student_id: string
  full_name: string
  login: string
  password: string
}

export interface IssueLoginsResult {
  issued: IssuedLogin[]
  skipped: Array<{ student_id: string; reason: string }>
}

export interface StaffCreated {
  login: string
  password: string
  full_name: string
}

export interface PasswordReset {
  full_name: string
  password: string
}

/** Витягує людський текст із відповіді функції, яка повернула помилку. */
async function describeError(error: unknown): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    try {
      const body = (await error.context.json()) as { error?: string }
      if (body?.error) return body.error
    } catch {
      // Тіло не JSON — падаємо на загальний текст нижче.
    }
    if (error.context.status === 401) return 'Сесія застаріла. Увійдіть ще раз.'
    if (error.context.status === 403) return 'Недостатньо прав для цієї дії.'
    return 'Сервер не зміг виконати дію з акаунтами.'
  }

  if (error instanceof FunctionsRelayError || error instanceof FunctionsFetchError) {
    return 'Немає зв’язку з сервером. Спробуйте ще раз.'
  }

  return (error as Error)?.message || 'Не вдалося виконати дію з акаунтами.'
}

async function callAccounts<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>('accounts', { body })
  if (error) throw new Error(await describeError(error))
  if (!data) throw new Error('Сервер повернув порожню відповідь.')
  return data
}

/** Видати логіни учням, які вже є в реєстрі класу (до 60 за раз). */
export function issueLogins(studentIds: string[]): Promise<IssueLoginsResult> {
  return callAccounts<IssueLoginsResult>({ action: 'issue_logins', student_ids: studentIds })
}

/** Створити співробітника. Доступно лише суперадміну. */
export function createStaff(
  fullName: string,
  role: Exclude<UserRole, 'superadmin' | 'student'>,
  classId?: string,
): Promise<StaffCreated> {
  return callAccounts<StaffCreated>({
    action: 'create_staff',
    full_name: fullName,
    role,
    ...(classId ? { class_id: classId } : {}),
  })
}

/**
 * Скинути пароль. Єдиний шлях відновлення доступу: логіни синтетичні,
 * пошта на них не ходить, тож «відновити через email» не існує.
 */
export function resetPassword(profileId: string): Promise<PasswordReset> {
  return callAccounts<PasswordReset>({ action: 'reset_password', profile_id: profileId })
}
