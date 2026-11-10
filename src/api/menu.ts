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
  special_menu_id: string | null
  dishes: Pick<Dish, 'id' | 'name' | 'category'>
}

const PLAIN_ITEM = 'id, menu_date, dish_id, special_menu_id, dishes(id, name, category)'

/**
 * Меню, що діє для класу в цей день: спеціальне, якщо клас у ньому, інакше
 * основне. Саме його place_order покладе в замовлення.
 */
export interface ClassMenu {
  /** null — основне меню */
  special: { id: string; name: string } | null
  items: MenuItemPlain[]
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

/** Найближчий день з порожнім основним меню — робочий режим редактора меню. */
export async function getNextEmptyDay(from: string = toIsoDate()): Promise<MenuDay | null> {
  const days = unwrap(
    await supabase
      .from('menu_days')
      .select('*, menu_items(id)')
      .is('menu_items.special_menu_id', null)
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

/** Усі компоненти дня — основного меню й спеціальних (див. special_menu_id). */
export async function listMenuItems(menuDate: string): Promise<MenuItemWithDish[]> {
  return unwrap(
    await supabase
      .from('menu_items')
      .select('*, dishes(id, name, category, is_active)')
      .eq('menu_date', menuDate),
    'Не вдалося отримати меню на день.',
  ) as unknown as MenuItemWithDish[]
}

/**
 * Компонент до основного меню (specialMenuId = null) чи до спеціального.
 * Ціну підставить тригер із довідника — тому після додавання викликають setDayPrice.
 */
export async function addMenuItem(
  menuDate: string,
  dishId: string,
  specialMenuId: string | null = null,
): Promise<MenuItem> {
  const { data, error } = await supabase
    .from('menu_items')
    .insert({ menu_date: menuDate, dish_id: dishId, special_menu_id: specialMenuId })
    .select('*')
    .single()

  if (error) {
    throw new Error(
      humanErrorWith(
        error,
        {
          '23505': 'Цей компонент уже є в цьому меню.',
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

/** Копіює основне меню й спеціальні (з класами й вартістю дня-джерела). */
export async function copyMenu(source: string, target: string): Promise<number> {
  const { data, error } = await supabase.rpc('copy_menu', { p_source: source, p_target: target })
  if (error) throw new Error(humanError(error, 'Не вдалося скопіювати меню.'))
  return data ?? 0
}

interface Assignment {
  menu_date: string
  special_menus: { id: string; name: string } | null
}

async function assignmentsOf(classId: string, dates: string[]): Promise<Assignment[]> {
  return unwrap(
    await supabase
      .from('special_menu_classes')
      .select('menu_date, special_menus(id, name)')
      .eq('class_id', classId)
      .in('menu_date', dates),
    'Не вдалося дізнатися, яке меню в класу.',
  ) as unknown as Assignment[]
}

/** Склад меню класу на день, без цін — для керівника, учня й «Дозамовити». */
export async function getClassMenu(menuDate: string, classId: string): Promise<ClassMenu> {
  const [assignment] = await assignmentsOf(classId, [menuDate])
  const special = assignment?.special_menus ?? null
  let query = supabase.from('menu_items').select(PLAIN_ITEM).eq('menu_date', menuDate)
  query = special ? query.eq('special_menu_id', special.id) : query.is('special_menu_id', null)
  const items = unwrap(await query, 'Не вдалося отримати меню на день.') as unknown as MenuItemPlain[]
  return { special, items }
}

/**
 * Те саме для набору днів. Саме набору, а не періоду: керівнику показуємо
 * лише опубліковані дні, тож і склад читаємо тільки для них — чернетка
 * не має доходити до клієнта навіть у мережевій відповіді.
 */
export async function getClassMenus(
  dates: string[],
  classId: string,
): Promise<Record<string, ClassMenu>> {
  if (dates.length === 0) return {}
  const [assignments, itemsResult] = await Promise.all([
    assignmentsOf(classId, dates),
    supabase.from('menu_items').select(PLAIN_ITEM).in('menu_date', dates).order('menu_date'),
  ])
  const items = unwrap(itemsResult, 'Не вдалося отримати меню.') as unknown as MenuItemPlain[]
  const specialOf = new Map(assignments.map((a) => [a.menu_date, a.special_menus]))
  const result: Record<string, ClassMenu> = {}
  for (const date of dates) {
    const special = specialOf.get(date) ?? null
    result[date] = {
      special,
      items: items.filter(
        (item) => item.menu_date === date && item.special_menu_id === (special?.id ?? null),
      ),
    }
  }
  return result
}

/** Дні періоду разом з кількістю компонентів основного меню — для перемикача дати. */
export async function listMenuDaysWithCounts(
  from: string,
  to: string,
): Promise<Array<MenuDay & { items_count: number }>> {
  const rows = unwrap(
    await supabase
      .from('menu_days')
      .select('*, menu_items(id)')
      .is('menu_items.special_menu_id', null)
      .gte('menu_date', from)
      .lte('menu_date', to)
      .order('menu_date'),
    'Не вдалося отримати дні меню.',
  ) as unknown as Array<MenuDay & { menu_items: { id: string }[] }>

  return rows.map(({ menu_items, ...day }) => ({ ...day, items_count: menu_items.length }))
}

/**
 * Чи приймаються ще замовлення на цю дату — питаємо сервер.
 *
 * Це та сама функція, на яку спирається place_order, тож розійтися з нею
 * відповідь не може. Годинник браузера в рішенні не бере участі взагалі:
 * він може відставати, поспішати або бути в іншому поясі.
 *
 * null означає «не вдалося дізнатися» — тоді нічого не блокуємо і лишаємо
 * рішення за сервером на момент самого замовлення.
 */
export async function areOrdersOpen(menuDate: string): Promise<boolean | null> {
  const { data, error } = await supabase.rpc('is_before_cutoff', { p_date: menuDate })
  if (error) return null
  return data === true
}

/**
 * Вартість блюда меню: основного (specialMenuId = null) чи спеціального.
 *
 * Кухар указує одну суму за все блюдо, а схема зберігає ціну на кожній позиції
 * меню. Тому суму кладемо на один компонент (перший за ідентифікатором — порядок
 * стабільний), а решті ставимо null. Усе, що рахує гроші — v_daily_totals,
 * costRows, звіт про відшкодування — підсумовує price_at_order, тож для них
 * нічого не змінюється.
 *
 * ⚠ Інваріант «рівно один компонент несе ціну» треба відновлювати після
 * кожної зміни складу: тригер stamp_menu_item підставляє ціну з довідника
 * при вставці, а видалення може забрати саме той компонент, що ніс суму.
 */
export async function setDayPrice(
  menuDate: string,
  total: number | null,
  specialMenuId: string | null = null,
): Promise<void> {
  // Кожне меню має власну вартість: суму кладемо на компонент саме цього меню.
  let query = supabase.from('menu_items').select('id').eq('menu_date', menuDate)
  query = specialMenuId ? query.eq('special_menu_id', specialMenuId) : query.is('special_menu_id', null)
  const rows = unwrap(await query.order('id'), 'Не вдалося прочитати склад блюда.') as Array<{
    id: string
  }>

  if (rows.length === 0) return

  const [carrier, ...rest] = rows

  const carrierResult = await supabase
    .from('menu_items')
    .update({ price: total })
    .eq('id', carrier.id)
    .select('id')
  if (carrierResult.error) {
    throw new Error(humanError(carrierResult.error, 'Не вдалося зберегти вартість блюда.'))
  }

  if (rest.length > 0) {
    const restResult = await supabase
      .from('menu_items')
      .update({ price: null })
      .in('id', rest.map((row) => row.id))
      .select('id')
    if (restResult.error) {
      throw new Error(humanError(restResult.error, 'Не вдалося зберегти вартість блюда.'))
    }
  }
}
