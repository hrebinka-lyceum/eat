import { supabase } from '@/lib/supabase'
import { unwrap, unwrapMaybe } from './helpers'
import { humanError } from '@/lib/errors'
import { toIsoDate } from '@/lib/format'
import type { Dish, MenuDay, MenuItem, MenuStatus } from '@/types/database'

export interface MenuItemWithDish extends MenuItem {
  dishes: Pick<Dish, 'id' | 'name' | 'category' | 'is_active'>
}

export async function listMenuDays(from: string, to: string): Promise<MenuDay[]> {
  return unwrap(
    await supabase
      .from('menu_days')
      .select('*')
      .gte('menu_date', from)
      .lte('menu_date', to)
      .order('menu_date'),
    'Не вдалося отримати дні меню.',
  )
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
  return unwrap(
    await supabase
      .from('menu_items')
      .insert({ menu_date: menuDate, dish_id: dishId, ...(price != null ? { price } : {}) })
      .select('*')
      .single(),
    'Не вдалося додати страву до меню.',
  )
}

export async function removeMenuItem(menuItemId: string): Promise<void> {
  const { error } = await supabase.from('menu_items').delete().eq('id', menuItemId)
  if (error) {
    throw new Error(
      humanError(error, 'Не вдалося прибрати страву — можливо, її вже замовили.'),
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
