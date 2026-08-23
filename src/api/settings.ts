import { supabase } from '@/lib/supabase'
import { unwrap } from './helpers'
import type { Settings, TablesUpdate } from '@/types/database'

export async function getSettings(): Promise<Settings> {
  return unwrap(
    await supabase.from('settings').select('*').limit(1).single(),
    'Не вдалося прочитати налаштування.',
  )
}

/** Оновлення доступне лише суперадміну — це вирішує RLS. */
export async function updateSettings(patch: TablesUpdate<'settings'>): Promise<Settings> {
  return unwrap(
    await supabase.from('settings').update(patch).eq('id', true).select('*').single(),
    'Не вдалося зберегти налаштування.',
  )
}
