import { supabase } from '@/lib/supabase'
import { humanError, humanErrorWith } from '@/lib/errors'
import { compareClassNames } from '@/lib/grades'
import { unwrap } from './helpers'
import type { SpecialMenu } from '@/types/database'

/**
 * Спеціальне меню дня для окремих класів. Для цих класів воно замінює основне:
 * їхні учні бачать і замовляють лише його (склад у замовлення кладе сервер).
 */
export interface SpecialMenuWithClasses extends SpecialMenu {
  classes: Array<{ id: string; name: string }>
}

interface SpecialMenuRow extends SpecialMenu {
  special_menu_classes: Array<{ class_id: string; classes: { id: string; name: string } | null }>
}

export async function listSpecialMenus(menuDate: string): Promise<SpecialMenuWithClasses[]> {
  const rows = unwrap(
    await supabase
      .from('special_menus')
      .select('id, menu_date, name, created_at, special_menu_classes(class_id, classes(id, name))')
      .eq('menu_date', menuDate)
      .order('created_at'),
    'Не вдалося отримати спеціальні меню.',
  ) as unknown as SpecialMenuRow[]

  return rows.map(({ special_menu_classes, ...menu }) => ({
    ...menu,
    classes: special_menu_classes
      .flatMap((link) => (link.classes ? [link.classes] : []))
      .sort((a, b) => compareClassNames(a.name, b.name)),
  }))
}

/**
 * Створити (без id) або змінити спеціальне меню — назва й класи одним викликом,
 * в одній транзакції на сервері. Повертає id меню.
 */
export async function saveSpecialMenu(input: {
  menuDate: string
  name: string
  classIds: string[]
  id?: string | null
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_special_menu', {
    p_menu_date: input.menuDate,
    p_name: input.name.trim(),
    p_class_ids: input.classIds,
    p_id: input.id ?? null,
  })
  if (error) throw new Error(humanError(error, 'Не вдалося зберегти спеціальне меню.'))
  return data as string
}

/** Разом зі складом і класами. Меню, за яким уже замовляли, не видаляється. */
export async function deleteSpecialMenu(id: string): Promise<void> {
  const { error } = await supabase.from('special_menus').delete().eq('id', id)
  if (error) {
    throw new Error(
      humanErrorWith(
        error,
        {
          '23503':
            'За цим меню вже є замовлення, тож видалити його не можна. Спершу скасуйте ці замовлення.',
        },
        'Не вдалося видалити спеціальне меню.',
      ),
    )
  }
}
