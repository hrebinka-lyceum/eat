import { SUPABASE_URL, supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/database'

// ---------------------------------------------------------------------------
//  Edge Function `accounts` — єдина точка керування акаунтами.
//
//  ⚠ Паролі повертаються рівно один раз і ніде не зберігаються: ні в стані
//  надовго, ні в localStorage, ні в базі. Показати їх треба одразу, інакше
//  залишиться тільки скинути наново.
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

async function callAccounts<T>(body: Record<string, unknown>): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) throw new Error('Сесія застаріла. Увійдіть ще раз.')

  let response: Response
  try {
    response = await fetch(`${SUPABASE_URL}/functions/v1/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new Error('Немає зв’язку з сервером. Спробуйте ще раз.')
  }

  const payload = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? 'Сервер не зміг виконати дію з акаунтами.')
  }
  return payload
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

export function resetPassword(profileId: string): Promise<PasswordReset> {
  return callAccounts<PasswordReset>({ action: 'reset_password', profile_id: profileId })
}
