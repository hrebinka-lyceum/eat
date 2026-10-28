import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Вартість блюда лежить на одному компоненті, решта мають price_at_order = null.
 * Тому «без ціни» — це замовлення, де null у **всіх** компонентах, а не будь-яка
 * позиція з null: інакше звіт про відшкодування щомісяця кричав би «Сума
 * неповна» про тисячі позицій, хоча сума правильна.
 *
 * Друга пастка — ліміт рядків. Supabase за замовчуванням віддає щонайбільше
 * 1000 рядків, а місяць замовлень школи — кілька тисяч. Заглушка ріже
 * відповідь так само, як сервер.
 */
const { server } = vi.hoisted(() => ({
  server: { rows: [] as unknown[], maxRows: 1000, requests: 0 },
}))

function chain() {
  const builder: Record<string, unknown> = {}
  let range: [number, number] | null = null
  for (const name of ['select', 'gte', 'lte', 'order']) builder[name] = vi.fn(() => builder)
  builder.range = vi.fn((from: number, to: number) => {
    range = [from, to]
    return builder
  })
  // Конструктор запиту supabase-js саме thenable: його очікують через await.
  // oxlint-disable-next-line no-thenable
  builder.then = (resolve: (value: { data: unknown; error: null }) => unknown) => {
    server.requests += 1
    const [from, to] = range ?? [0, Number.MAX_SAFE_INTEGER]
    const end = Math.min(to + 1, from + server.maxRows)
    return resolve({ data: server.rows.slice(from, end), error: null })
  }
  return builder
}

vi.mock('@/lib/supabase', () => ({
  SUPABASE_URL: 'http://localhost',
  supabase: { from: vi.fn(() => chain()), rpc: vi.fn() },
}))

const { costRows } = await import('@/api/stats')

const order = (prices: Array<number | null>, day = '2026-10-01') => ({
  menu_date: day,
  class_id: 'c1',
  privileged_at_order: false,
  order_items: prices.map((price_at_order) => ({ price_at_order })),
})

beforeEach(() => {
  server.maxRows = 1000
  server.requests = 0
})

describe('costRows', () => {
  it('замовлення, де вартість лежить на одному компоненті, має повну суму', async () => {
    server.rows = [order([58.4, null, null, null])]

    const [row] = await costRows('2026-10-01', '2026-10-31')

    expect(row.cost).toBe(58.4)
    expect(row.unpriced).toBe(false)
  })

  it('замовлення на день без вартості блюда позначає окремо', async () => {
    server.rows = [order([null, null, null])]

    const [row] = await costRows('2026-10-01', '2026-10-31')

    expect(row.cost).toBe(0)
    expect(row.unpriced).toBe(true)
  })

  // 400 учнів × 22 дні — майже 9 тисяч замовлень. Без пагінації звіт про
  // відшкодування рахував би першу тисячу і мовчав.
  it('читає всі сторінки, а не першу тисячу', async () => {
    server.rows = Array.from({ length: 2500 }, () => order([50, null]))

    const rows = await costRows('2026-10-01', '2026-10-31')

    expect(rows).toHaveLength(2500)
    expect(rows.reduce((sum, row) => sum + row.cost, 0)).toBe(125000)
  })

  // Якщо в проєкті ліміт менший за розмір сторінки, крок «+1000» перестрибнув
  // би частину рядків. Зсуваємося на кількість отриманих.
  it('не губить рядки, коли ліміт сервера менший за сторінку', async () => {
    server.maxRows = 400
    server.rows = Array.from({ length: 1000 }, () => order([10]))

    const rows = await costRows('2026-10-01', '2026-10-31')

    expect(rows).toHaveLength(1000)
  })
})
