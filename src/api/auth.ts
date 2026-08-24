import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { humanError } from '@/lib/errors'

/** Логін: малі латинські літери, цифри й крапка — саме такі видає система. */
export const LOGIN_PATTERN = /^[a-z0-9._-]+$/

/** Приводить введене до вигляду логіна: без пробілів і у нижньому регістрі. */
export function normalizeLogin(input: string): string {
  return input.trim().toLowerCase()
}

/**
 * Вхід за логіном.
 *
 * Supabase автентифікує за поштою, тож логін спершу перетворюємо на неї
 * функцією email_for_login на сервері: незалогінений клієнт не може читати
 * ні profiles, ні settings, тож зібрати адресу самотужки він не здатен.
 *
 * Якщо ввели адресу з «@» — використовуємо її як є: старі логіни-пошти
 * мають працювати далі.
 */
export async function signInWithLogin(login: string, password: string): Promise<Session> {
  const identifier = normalizeLogin(login)

  if (identifier.includes('@')) return signIn(identifier, password)

  const { data, error } = await supabase.rpc('email_for_login', { p_login: identifier })

  if (error) {
    if (error.code === 'PGRST202') {
      throw new Error(
        'Вхід за логіном ще не налаштований на сервері. Зверніться до адміністратора системи.',
      )
    }
    throw new Error(humanError(error, 'Не вдалося перевірити логін.'))
  }

  // Невідомий логін і невірний пароль дають однакову відповідь: підказувати,
  // які логіни існують, ні до чого.
  if (!data) throw new Error('Невірний логін або пароль.')

  return signIn(data, password)
}

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
