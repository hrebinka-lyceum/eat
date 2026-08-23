import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from './helpers'
import type { Profile, UserRole, Views } from '@/types/database'

export async function getProfile(userId: string): Promise<Profile | null> {
  return unwrapMaybe(
    await supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    'Не вдалося прочитати профіль.',
  )
}

export async function listProfiles(): Promise<Profile[]> {
  return unwrap(
    await supabase.from('profiles').select('*').order('full_name'),
    'Не вдалося отримати список користувачів.',
  )
}

export async function listStaff(): Promise<Profile[]> {
  return unwrap(
    await supabase
      .from('profiles')
      .select('*')
      .in('role', ['superadmin', 'admin', 'cafeteria', 'teacher'])
      .order('full_name'),
    'Не вдалося отримати список співробітників.',
  )
}

/** Скидає прапорець після успішної зміни пароля. */
export async function clearMustChangePassword(userId: string): Promise<void> {
  unwrap(
    await supabase
      .from('profiles')
      .update({ must_change_password: false })
      .eq('id', userId)
      .select('id'),
    'Пароль змінено, але не вдалося оновити профіль.',
  )
}

/** Зміна ролі — лише суперадмін (стереже тригер guard_profile_update). */
export async function setRole(profileId: string, role: UserRole): Promise<void> {
  unwrap(
    await supabase.from('profiles').update({ role }).eq('id', profileId).select('id'),
    'Не вдалося змінити роль.',
  )
}

export async function setStatus(profileId: string, status: 'active' | 'disabled'): Promise<void> {
  unwrap(
    await supabase.from('profiles').update({ status }).eq('id', profileId).select('id'),
    'Не вдалося змінити статус.',
  )
}

export async function setFullName(profileId: string, fullName: string): Promise<void> {
  unwrap(
    await supabase.from('profiles').update({ full_name: fullName }).eq('id', profileId).select('id'),
    'Не вдалося змінити ім’я.',
  )
}

/** Керівники без класу в поточному році — кандидати на нові п'яті. */
export async function listUnassignedTeachers(): Promise<Views<'v_unassigned_teachers'>[]> {
  return unwrap(
    await supabase.from('v_unassigned_teachers').select('*').order('full_name'),
    'Не вдалося отримати список вільних керівників.',
  )
}
