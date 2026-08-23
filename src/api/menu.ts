import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from './helpers'
import { humanError, humanErrorWith } from '@/lib/errors'
import { toIsoDate } from '@/lib/format'
import type { Dish, MenuDay, MenuItem, MenuStatus } from '@/types/database'

export interface MenuItemWithDish extends MenuItem {
  dishes: Pick<Dish, 'id' | 'name' | 'category' | 'is_active'>
}

/**
 * Позиція меню без ціни — для екранів класного керівника й учня.
 *
 * dishes.price сервер віддає всім (RLS на довіднику страв немає), тож
 * єдиний надійний спосіб не показати ціну там, де її не має бути, —
 * не запитувати її взагалі.
 */
export interface MenuItemPlain {
  id: string
  menu_date: string
  dish_id: string
  dishes: Pick<Dish, 'id' | 'name' | 'category'>
}

export async function listMenuDays(
  from: string,
  to: string,
  opts: { status?: MenuStatus } = {},
): Promise<MenuDay[]> {
  let query = supabase.from('menu_days').select('*').gte('menu_date', from).lte('menu_date', to)
  if (opts.status) query = query.eq('status', opts.status)
  return unwrap(await query.order('menu_date'), 'Не вдалося отримати дні меню.')
}

export async function getMenuDay(menuDate: string): Promise<MenuDay | null> {
  return unwrapMaybe(
    await supabase.from('menu_days').select('*').eq('menu_date', menuDate).maybeSingle(),
    'Не вдалося прочитати день меню.',
  )
}

/**
 * Найближчий опублікований день — головний екран учня.
 * Учень бачить лише published: так вирішує RLS.
 */
export async function getNextPublishedDay(from: string = toIsoDate()): Promise<MenuDay | null> {
  return unwrapMaybe(
    await supabase
      .from('menu_days')
      .select('*')
      .eq('status', 'published')
      .gte('menu_date', from)
      .order('menu_date')
      .limit(1)
      .maybeSingle(),
    'Не вдалося знайти найближче меню.',
  )
}

/** Найближчий день без жодної страви — робочий режим редактора меню. */
export async function getNextEmptyDay(from: string = toIsoDate()): Promise<MenuDay | null> {
  const days = unwrap(
    await supabase
      .from('menu_days')
      .select('*, menu_items(id)')
      .gte('menu_date', from)
      .order('menu_date')
      .limit(30),
    'Не вдалося знайти незаповнений день.',
  ) as unknown as Array<MenuDay & { menu_items: { id: string }[] }>

  const empty = days.find((d) => d.menu_items.length === 0)
  if (!empty) return null
  const { menu_items: _items, ...day } = empty
  return day
}

export async function listMenuItems(menuDate: string): Promise<MenuItemWithDish[]> {
  return unwrap(
    await supabase
      .from('menu_items')
      .select('*, dishes(id, name, category, is_active)')
      .eq('menu_date', menuDate),
    'Не вдалося отримати меню на день.',
  ) as unknown as MenuItemWithDish[]
}

/** Ціну підставить тригер із довідника, якщо не вказати явно. */
export async function addMenuItem(
  menuDate: string,
  dishId: string,
  price?: number | null,
): Promise<MenuItem> {
  const { data, error } = await supabase
    .from('menu_items')
    .insert({ menu_date: menuDate, dish_id: dishId, ...(price != null ? { price } : {}) })
    .select('*')
    .single()

  if (error) {
    throw new Error(
      humanErrorWith(
        error,
        {
          '23505': 'Ця страва вже є в меню на цей день.',
          '23503': 'Дня меню ще не існує — спершу створіть його.',
        },
        'Не вдалося додати страву до меню.',
      ),
    )
  }
  return data
}

export async function removeMenuItem(menuItemId: string): Promise<void> {
  const { error } = await supabase.from('menu_items').delete().eq('id', menuItemId)
  if (error) {
    throw new Error(
      humanErrorWith(
        error,
        {
          '23503':
            'Цю страву вже замовили на цей день, тому прибрати її з меню не можна: ' +
            'замовлення незмінні.',
        },
        'Не вдалося прибрати страву з меню.',
      ),
    )
  }
}

/** Ручне перевизначення ціни на конкретний день: ціна продуктів стрибає. */
export async function setMenuItemPrice(menuItemId: string, price: number | null): Promise<MenuItem> {
  return unwrap(
    await supabase.from('menu_items').update({ price }).eq('id', menuItemId).select('*').single(),
    'Не вдалося змінити ціну.',
  )
}

export async function createMenuDay(menuDate: string): Promise<MenuDay> {
  return unwrap(
    await supabase.from('menu_days').insert({ menu_date: menuDate }).select('*').single(),
    'Не вдалося створити день меню.',
  )
}

export async function setMenuDayStatus(menuDate: string, status: MenuStatus): Promise<MenuDay> {
  return unwrap(
    await supabase.from('menu_days').update({ status }).eq('menu_date', menuDate).select('*').single(),
    'Не вдалося змінити статус дня.',
  )
}

/** Робочі дні періоду; вихідні функція пропускає сама. */
export async function generateMenuDays(from: string, to: string): Promise<number> {
  const { data, error } = await supabase.rpc('generate_menu_days', { p_from: from, p_to: to })
  if (error) throw new Error(humanError(error, 'Не вдалося згенерувати дні меню.'))
  return data ?? 0
}

/** Копіює склад меню; ціни беруться поточні з довідника. */
export async function copyMenu(source: string, target: string): Promise<number> {
  const { data, error } = await supabase.rpc('copy_menu', { p_source: source, p_target: target })
  if (error) throw new Error(humanError(error, 'Не вдалося скопіювати меню.'))
  return data ?? 0
}

/** Склад меню без цін — для керівника та учня. */
export async function listMenuItemsPlain(menuDate: string): Promise<MenuItemPlain[]> {
  return unwrap(
    await supabase
      .from('menu_items')
      .select('id, menu_date, dish_id, dishes(id, name, category)')
      .eq('menu_date', menuDate),
    'Не вдалося отримати меню на день.',
  ) as unknown as MenuItemPlain[]
}

/**
 * Те саме для набору днів. Саме набору, а не періоду: керівнику показуємо
 * лише опубліковані дні, тож і склад читаємо тільки для них — чернетка
 * не має доходити до клієнта навіть у мережевій відповіді.
 */
export async function listMenuItemsPlainForDates(dates: string[]): Promise<MenuItemPlain[]> {
  if (dates.length === 0) return []
  return unwrap(
    await supabase
      .from('menu_items')
      .select('id, menu_date, dish_id, dishes(id, name, category)')
      .in('menu_date', dates)
      .order('menu_date'),
    'Не вдалося отримати меню.',
  ) as unknown as MenuItemPlain[]
}

/** Дні періоду разом з кількістю страв — для перемикача дати в редакторі. */
export async function listMenuDaysWithCounts(
  from: string,
  to: string,
): Promise<Array<MenuDay & { items_count: number }>> {
  const rows = unwrap(
    await supabase
      .from('menu_days')
      .select('*, menu_items(id)')
      .gte('menu_date', from)
      .lte('menu_date', to)
      .order('menu_date'),
    'Не вдалося отримати дні меню.',
  ) as unknown as Array<MenuDay & { menu_items: { id: string }[] }>

  return rows.map(({ menu_items, ...day }) => ({ ...day, items_count: menu_items.length }))
}
