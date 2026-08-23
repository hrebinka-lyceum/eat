// ---------------------------------------------------------------------------
//  Людські повідомлення замість сирих текстів Postgres.
//
//  Помилки RLS виглядають дивно: часто це порушення унікальності або порожній
//  результат замість «доступ заборонено». Показувати користувачу код 42501 чи
//  назву констрейнта не можна.
// ---------------------------------------------------------------------------

const CODE_MESSAGES: Record<string, string> = {
  '42501': 'Недостатньо прав для цієї дії.',
  '23505': 'Такий запис уже існує.',
  '23503': 'Запис пов’язаний з іншими даними — його не можна змінити чи видалити.',
  '23514': 'Дані не проходять перевірку — перевірте заповнені поля.',
  '23502': 'Не заповнено обов’язкове поле.',
  '22007': 'Некоректна дата.',
  PGRST301: 'Сесія застаріла. Увійдіть ще раз.',
  PGRST116: 'Запис не знайдено або він вам недоступний.',
}

const AUTH_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Невірний логін або пароль.',
  email_not_confirmed: 'Акаунт не підтверджено. Зверніться до адміністратора.',
  user_banned: 'Акаунт заблоковано. Зверніться до адміністратора.',
  over_request_rate_limit: 'Забагато спроб. Зачекайте хвилину й спробуйте ще раз.',
  same_password: 'Новий пароль має відрізнятися від поточного.',
  weak_password: 'Пароль занадто простий. Мінімум 6 символів.',
}

interface MaybeSupabaseError {
  message?: string
  code?: string
  details?: string
  hint?: string
  status?: number
}

/**
 * Перетворює будь-яку помилку від Supabase на речення українською.
 *
 * Повідомлення, які кидають наші власні SQL-функції (place_order,
 * purge_data тощо), уже написані українською — їх показуємо як є.
 */
export function humanError(error: unknown, fallback = 'Не вдалося виконати дію.'): string {
  if (!error) return fallback

  const err = error as MaybeSupabaseError
  const raw = (err.message ?? '').trim()

  // Наші функції кидають готовий український текст.
  if (/[а-яїієґ]/i.test(raw)) {
    return raw.replace(/^ERROR:\s*/i, '')
  }

  if (err.code && CODE_MESSAGES[err.code]) return CODE_MESSAGES[err.code]
  if (err.code && AUTH_MESSAGES[err.code]) return AUTH_MESSAGES[err.code]

  const lower = raw.toLowerCase()
  if (lower.includes('invalid login credentials')) return AUTH_MESSAGES.invalid_credentials
  if (lower.includes('permission denied')) return CODE_MESSAGES['42501']
  if (lower.includes('row-level security')) return CODE_MESSAGES['42501']
  if (lower.includes('duplicate key')) return CODE_MESSAGES['23505']
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Немає зв’язку з сервером. Перевірте інтернет і спробуйте ще раз.'
  }
  if (err.status === 401) return 'Сесія застаріла. Увійдіть ще раз.'
  if (err.status === 403) return CODE_MESSAGES['42501']

  return fallback
}

/** Порушення зовнішнього ключа: на запис хтось посилається. */
export function isForeignKeyViolation(error: unknown): boolean {
  return (error as MaybeSupabaseError)?.code === '23503'
}

/** Порушення унікальності. */
export function isUniqueViolation(error: unknown): boolean {
  return (error as MaybeSupabaseError)?.code === '23505'
}

/**
 * Те саме, що humanError, але для випадків, коли конкретний код помилки
 * значить у цьому місці щось конкретніше за загальний текст.
 */
export function humanErrorWith(
  error: unknown,
  overrides: Partial<Record<'23503' | '23505' | '42501', string>>,
  fallback?: string,
): string {
  const code = (error as MaybeSupabaseError)?.code
  if (code && code in overrides) return overrides[code as keyof typeof overrides] as string
  return humanError(error, fallback)
}
