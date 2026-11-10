import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Найважливіше правило проєкту: на екранах учня й класного керівника ціни
 * не має бути — і не тому, що колонку сховали, а тому, що її немає у
 * відповіді сервера. RLS цих полів не фільтрує, тож відповідальність на нас.
 *
 * Ловимо рядок select() і перевіряємо, що в ньому немає жодного price.
 */
const selects: string[] = []

function chain() {
  const builder: Record<string, unknown> = {}
  const methods = [
    'select', 'eq', 'in', 'gte', 'lte', 'is', 'or', 'order', 'limit', 'insert',
    'update', 'delete', 'maybeSingle', 'single', 'range',
  ]
  for (const name of methods) {
    builder[name] = vi.fn((...args: unknown[]) => {
      if (name === 'select') selects.push(String(args[0]))
      return builder
    })
  }
  // Конструктор запиту в supabase-js саме thenable: його не викликають,
  // а очікують через await. Заглушка мусить поводитись так само.
  // oxlint-disable-next-line no-thenable
  builder.then = (resolve: (value: { data: unknown[]; error: null }) => unknown) =>
    resolve({ data: [], error: null })
  return builder
}

vi.mock('@/lib/supabase', () => ({
  SUPABASE_URL: 'http://localhost',
  supabase: {
    from: vi.fn(() => chain()),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}))

const { getClassMenu, getClassMenus, listMenuItems } = await import('@/api/menu')
const { getOrderPlain, listOrdersPlainOfStudent, listOrdersPlainOfClass, getOrderOfStudent } =
  await import('@/api/orders')
const { timesheetOrders } = await import('@/api/reports')

beforeEach(() => {
  selects.length = 0
})

const lastSelect = () => selects[selects.length - 1]

describe('запити без цін (учень і класний керівник)', () => {
  // Меню класу — два запити: чи клас у спеціальному меню, і склад. Обидва без цін.
  it('меню класу на день (основне чи спеціальне)', async () => {
    await getClassMenu('2026-09-01', 'c1')
    expect(selects.length).toBeGreaterThanOrEqual(2)
    for (const select of selects) expect(select).not.toMatch(/price/)
    expect(lastSelect()).toContain('dishes(id, name, category)')
  })

  it('меню класу за набір днів', async () => {
    await getClassMenus(['2026-09-01'], 'c1')
    expect(selects.length).toBeGreaterThanOrEqual(2)
    for (const select of selects) expect(select).not.toMatch(/price/)
  })

  it('своє замовлення', async () => {
    await getOrderPlain('s1', '2026-09-01')
    expect(lastSelect()).not.toMatch(/price/)
  })

  it('історія замовлень учня', async () => {
    await listOrdersPlainOfStudent('s1')
    expect(lastSelect()).not.toMatch(/price/)
  })

  it('замовлення класу', async () => {
    await listOrdersPlainOfClass('c1', '2026-09-01')
    expect(lastSelect()).not.toMatch(/price/)
  })

  it('табель — його бачить і керівник', async () => {
    await timesheetOrders('c1', '2026-09-01', '2026-09-30')
    expect(lastSelect()).not.toMatch(/price/)
  })
})

describe('запити з цінами (їдальня й адміністрація)', () => {
  it('редактор меню читає ціну — інакше її не відредагувати', async () => {
    await listMenuItems('2026-09-01')
    expect(lastSelect()).toMatch(/\*/)
  })

  it('повне замовлення з цінами існує окремо', async () => {
    await getOrderOfStudent('s1', '2026-09-01')
    expect(lastSelect()).toMatch(/price_at_order|\*/)
  })
})
