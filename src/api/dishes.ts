import { supabase } from '@/lib/supabase'
import { unwrap } from './helpers'
import { humanErrorWith } from '@/lib/errors'
import type { Dish, TablesInsert, TablesUpdate } from '@/types/database'

/**
 * Довідник страв. Ціна — собівартість порції для школи; редагують її
 * лише їдальня та адміністрація, а бачать її не всі ролі.
 */
export async function listDishes(opts: { includeInactive?: boolean } = {}): Promise<Dish[]> {
  let query = supabase.from('dishes').select('*')
  if (!opts.includeInactive) query = query.eq('is_active', true)
  return unwrap(await query.order('category').order('name'), 'Не вдалося отримати довідник страв.')
}

export async function createDish(payload: TablesInsert<'dishes'>): Promise<Dish> {
  return unwrap(
    await supabase.from('dishes').insert(payload).select('*').single(),
    'Не вдалося додати страву.',
  )
}

export async function updateDish(dishId: string, patch: TablesUpdate<'dishes'>): Promise<Dish> {
  return unwrap(
    await supabase.from('dishes').update(patch).eq('id', dishId).select('*').single(),
    'Не вдалося зберегти страву.',
  )
}

/** Страву не видаляють: на неї посилаються меню минулих днів. */
export async function setDishActive(dishId: string, isActive: boolean): Promise<Dish> {
  return updateDish(dishId, { is_active: isActive })
}

/**
 * Видалення. Спрацює лише для страви, якої немає в жодному меню:
 * menu_items посилається на dishes з on delete restrict, і це навмисно —
 * інакше зникла б історія замовлень. Ту, що вже використовували,
 * прибирають з обігу через is_active.
 */
export async function deleteDish(dishId: string): Promise<void> {
  const { error } = await supabase.from('dishes').delete().eq('id', dishId)
  if (error) {
    throw new Error(
      humanErrorWith(
        error,
        {
          '23503':
            'Страва вже була в меню, тому видалити її не можна — на неї спираються ' +
            'замовлення. Зробіть її неактивною: з редактора меню вона зникне, а історія залишиться.',
        },
        'Не вдалося видалити страву.',
      ),
    )
  }
}
