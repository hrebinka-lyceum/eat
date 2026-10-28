import { supabase } from '@/lib/supabase'
import { likeEscape, unwrap } from './helpers'
import { humanErrorWith } from '@/lib/errors'
import type { Dish, DishCategory, TablesInsert, TablesUpdate } from '@/types/database'

/**
 * Категорія, яку пишемо кожному новому компоненту. Колонка в схемі
 * обов'язкова, але продукт категорій більше не має — значення одне й те саме
 * і ніде не показується.
 */
export const COMPONENT_CATEGORY: DishCategory = 'second'

/**
 * Довідник компонентів блюда (гречана каша, котлета, чай…).
 *
 * `category` і `price` у схемі лишилися, але продукт ними більше не оперує:
 * категорій немає, а вартість указується одна на все блюдо дня. Тому в
 * довіднику — лише назва й активність.
 */
export async function listDishes(opts: { includeInactive?: boolean } = {}): Promise<Dish[]> {
  let query = supabase.from('dishes').select('*')
  if (!opts.includeInactive) query = query.eq('is_active', true)
  return unwrap(await query.order('name'), 'Не вдалося отримати довідник компонентів.')
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

/** «  гречана   каша » → «Гречана каша»: зайві пробіли геть, перша літера велика. */
export function normalizeComponentName(name: string): string {
  const clean = name.trim().replace(/\s+/g, ' ')
  return clean.charAt(0).toLocaleUpperCase('uk') + clean.slice(1)
}

/**
 * Компонент за назвою — знайти або створити.
 *
 * Назва в базі не унікальна, тож без цієї перевірки «гречана каша», набрана
 * в редакторі меню, стала б другою «Гречаною кашею» в довіднику. Шукаємо без
 * урахування регістру і серед вимкнених: вимкнений вмикаємо, а не дублюємо.
 */
export async function findOrCreateComponent(name: string): Promise<Dish> {
  const clean = normalizeComponentName(name)
  if (!clean) throw new Error('Вкажіть назву компонента.')

  const existing = unwrap(
    await supabase.from('dishes').select('*').ilike('name', likeEscape(clean)).limit(1),
    'Не вдалося перевірити довідник компонентів.',
  )[0]

  if (existing) return existing.is_active ? existing : setDishActive(existing.id, true)
  return createDish({ name: clean, category: COMPONENT_CATEGORY, price: null })
}
