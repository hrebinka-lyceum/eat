import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { humanError } from '@/lib/errors'

export async function signIn(email: string, password: string): Promise<Session> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error(humanError(error, 'Не вдалося увійти.'))
  if (!data.session) throw new Error('Не вдалося увійти.')
  return data.session
}

export async function signOut(): Promise<void> {
  const { error } = await supabase.auth.signOut()
  if (error) throw new Error(humanError(error, 'Не вдалося вийти.'))
}

export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/**
 * Зміна власного пароля. Пароль ніде не зберігається — ні в стані,
 * ні в localStorage; він живе рівно стільки, скільки триває цей виклик.
 */
export async function changePassword(newPassword: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(humanError(error, 'Не вдалося змінити пароль.'))
}

export function onAuthStateChange(callback: (session: Session | null) => void) {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(session))
  return () => data.subscription.unsubscribe()
}
