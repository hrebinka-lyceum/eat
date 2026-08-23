import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

// У фронтенді живе виключно anon-ключ. Це задумано: доступ до рядків
// вирішує RLS на сервері. service_role сюди не потрапляє ніколи.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    'Не задано VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY. ' +
      'Локально — у файлі .env, на GitHub Pages — у секретах репозиторію.',
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

export const SUPABASE_URL = url
