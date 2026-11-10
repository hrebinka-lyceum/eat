import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Спеціальне меню замінює основне для своїх класів. Тут — що клієнт читає
 * саме меню класу, а не все підряд, і що кухня рахує порції за меню.
 */
interface Call {
  table: string
  filters: unknown[][]
}

const calls: Call[] = []
let responses: Record<string, unknown[]> = {}

function chain(table: string) {
  const call: Call = { table, filters: [] }
  calls.push(call)
  const builder: Record<string, unknown> = {}
  for (const name of ['select', 'eq', 'in', 'is', 'order', 'range', 'delete']) {
    builder[name] = vi.fn((...args: unknown[]) => {
      if (name !== 'select') call.filters.push([name, ...args])
      return builder
    })
  }
  // oxlint-disable-next-line no-thenable
  builder.then = (resolve: (value: { data: unknown; error: null }) => unknown) => {
    // Друга сторінка пагінації — порожня.
    const isLaterPage = call.filters.some((f) => f[0] === 'range' && (f[1] as number) > 0)
    return resolve({ data: isLaterPage ? [] : (responses[table] ?? []), error: null })
  }
  return builder
}

const rpc = vi.fn()
vi.mock('@/lib/supabase', () => ({
  SUPABASE_URL: 'http://localhost',
  supabase: { from: vi.fn((table: string) => chain(table)), rpc: (...args: unknown[]) => rpc(...args) },
}))

const { getClassMenu, getClassMenus } = await import('@/api/menu')
const { listSpecialMenus, saveSpecialMenu } = await import('@/api/specialMenus')
const { ordersByMenu } = await import('@/api/stats')

const item = (id: string, date: string, special: string | null, name: string) => ({
  id, menu_date: date, dish_id: `d-${id}`, special_menu_id: special,
  dishes: { id: `d-${id}`, name, category: 'second' },
})

beforeEach(() => {
  calls.length = 0
  responses = {}
  rpc.mockReset()
})

const itemFilters = () => calls.find((call) => call.table === 'menu_items')!.filters

describe('меню класу', () => {
  it('клас у спеціальному меню — читаємо лише його склад', async () => {
    responses.special_menu_classes = [
      { menu_date: '2026-09-01', special_menus: { id: 'sm1', name: 'Дієтичне' } },
    ]
    responses.menu_items = [item('s1', '2026-09-01', 'sm1', 'Рисова каша')]

    const menu = await getClassMenu('2026-09-01', 'c1')

    expect(menu.special).toEqual({ id: 'sm1', name: 'Дієтичне' })
    expect(itemFilters()).toContainEqual(['eq', 'special_menu_id', 'sm1'])
    expect(menu.items.map((i) => i.dishes.name)).toEqual(['Рисова каша'])
  })

  it('клас без спеціального меню — лише основне', async () => {
    responses.special_menu_classes = []
    responses.menu_items = [item('m1', '2026-09-01', null, 'Гречана каша')]

    const menu = await getClassMenu('2026-09-01', 'c7')

    expect(menu.special).toBeNull()
    expect(itemFilters()).toContainEqual(['is', 'special_menu_id', null])
  })

  // Для кількох днів склад читається разом, а розкладається по днях:
  // у понеділок клас у спецменю, у вівторок — на основному.
  it('за кілька днів кожен день отримує своє меню', async () => {
    responses.special_menu_classes = [
      { menu_date: '2026-09-01', special_menus: { id: 'sm1', name: '' } },
    ]
    responses.menu_items = [
      item('m1', '2026-09-01', null, 'Гречана каша'),
      item('s1', '2026-09-01', 'sm1', 'Рисова каша'),
      item('m2', '2026-09-02', null, 'Омлет'),
      item('x2', '2026-09-02', 'sm-other', 'Сирники'),
    ]

    const menus = await getClassMenus(['2026-09-01', '2026-09-02'], 'c1')

    expect(menus['2026-09-01'].items.map((i) => i.dishes.name)).toEqual(['Рисова каша'])
    expect(menus['2026-09-02'].special).toBeNull()
    expect(menus['2026-09-02'].items.map((i) => i.dishes.name)).toEqual(['Омлет'])
  })
})

describe('спеціальні меню дня', () => {
  it('класи впорядковано природно: 2-А раніше за 10-А', async () => {
    responses.special_menus = [
      {
        id: 'sm1', menu_date: '2026-09-01', name: 'Дієтичне', created_at: '',
        special_menu_classes: [
          { class_id: 'c10', classes: { id: 'c10', name: '10-А' } },
          { class_id: 'c2', classes: { id: 'c2', name: '2-А' } },
        ],
      },
    ]
    const [menu] = await listSpecialMenus('2026-09-01')
    expect(menu.classes.map((c) => c.name)).toEqual(['2-А', '10-А'])
  })

  it('збереження — один виклик сервера з назвою без пробілів і класами', async () => {
    rpc.mockResolvedValue({ data: 'sm1', error: null })
    const id = await saveSpecialMenu({ menuDate: '2026-09-01', name: '  Дієтичне ', classIds: ['c1', 'c2'] })
    expect(id).toBe('sm1')
    expect(rpc).toHaveBeenCalledWith('save_special_menu', {
      p_menu_date: '2026-09-01', p_name: 'Дієтичне', p_class_ids: ['c1', 'c2'], p_id: null,
    })
  })

  it('відмову сервера показуємо його ж словами', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Клас 7-А уже має замовлення на 01.09.2026 — меню для нього на цей день змінити не можна.' },
    })
    await expect(
      saveSpecialMenu({ menuDate: '2026-09-01', name: '', classIds: ['c7'], id: 'sm1' }),
    ).rejects.toThrow('Клас 7-А уже має замовлення')
  })
})

describe('порції за меню', () => {
  it('рахує окремо основне й кожне спеціальне', async () => {
    responses.orders = [
      { id: 'o1', special_menu_id: null },
      { id: 'o2', special_menu_id: 'sm1' },
      { id: 'o3', special_menu_id: null },
      { id: 'o4', special_menu_id: 'sm1' },
      { id: 'o5', special_menu_id: 'sm2' },
    ]
    expect(await ordersByMenu('2026-09-01')).toEqual({ main: 2, special: { sm1: 2, sm2: 1 } })
  })
})
