import { supabase } from '@/lib/supabase'
import { unwrap } from './helpers'
import { humanErrorWith } from '@/lib/errors'
import type { PrivilegeCategory } from '@/types/database'

/**
 * Довідник пільгових категорій. Веде адміністрація; класний керівник лише
 * обирає категорію в картці учня.
 */
export async function listPrivilegeCategories(): Promise<PrivilegeCategory[]> {
  const rows = unwrap(
    await supabase.from('privilege_categories').select('*').order('name'),
    'Не вдалося отримати пільгові категорії.',
  )
  // Сервер сортує за байтами — «Ї» опинилась би після «Я».
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'uk'))
}

export async function createPrivilegeCategory(name: string): Promise<PrivilegeCategory> {
  const { data, error } = await supabase
    .from('privilege_categories')
    .insert({ name: name.trim() })
    .select('*')
    .single()
  if (error) {
    throw new Error(
      humanErrorWith(error, { '23505': 'Така категорія вже є.' }, 'Не вдалося додати категорію.'),
    )
  }
  return data
}

export async function updatePrivilegeCategory(
  id: string,
  patch: { name?: string; is_active?: boolean },
): Promise<PrivilegeCategory> {
  const { data, error } = await supabase
    .from('privilege_categories')
    .update(patch.name !== undefined ? { ...patch, name: patch.name.trim() } : patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) {
    throw new Error(
      humanErrorWith(error, { '23505': 'Така категорія вже є.' }, 'Не вдалося зберегти категорію.'),
    )
  }
  return data
}

/** Видаляється лише категорія, якою не позначено жодного учня. */
export async function deletePrivilegeCategory(id: string): Promise<void> {
  const { error } = await supabase.from('privilege_categories').delete().eq('id', id)
  if (error) {
    throw new Error(
      humanErrorWith(
        error,
        {
          '23503':
            'Цією категорією вже позначено учнів, тому видалити її не можна. ' +
            'Вимкніть її — у картках учнів вона більше не пропонуватиметься.',
        },
        'Не вдалося видалити категорію.',
      ),
    )
  }
}
