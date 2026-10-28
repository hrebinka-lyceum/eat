import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Кухар указує одну вартість за все блюдо, а схема зберігає ціну на кожній
 * позиції меню. Інваріант: рівно один компонент несе суму, решта — null.
 * Інакше підсумки (v_daily_totals, звіт про відшкодування) порахували б
 * вартість блюда стільки разів, скільки в ньому компонентів.
 */
interface Update {
  price: number | null
  ids: string[]
}

const updates: Update[] = []
let rows: Array<{ id: string }> = []

function chain() {
  const builder: Record<string, unknown> = {}
  let pending: { price: number | null } | null = null
  const ids: string[] = []

  for (const name of ['select', 'eq', 'in', 'order', 'update']) {
    builder[name] = vi.fn((...args: unknown[]) => {
      if (name === 'update') pending = args[0] as { price: number | null }
      if (name === 'eq' && args[0] === 'id') ids.push(String(args[1]))
      if (name === 'in' && args[0] === 'id') ids.push(...(args[1] as string[]))
      return builder
    })
  }

  // Конструктор запиту supabase-js саме thenable: його очікують через await.
  // oxlint-disable-next-line no-thenable
  builder.then = (resolve: (value: { data: unknown; error: null }) => unknown) => {
    if (pending) updates.push({ price: pending.price, ids: [...ids] })
    return resolve({ data: pending ? [] : rows, error: null })
  }
  return builder
}

vi.mock('@/lib/supabase', () => ({
  SUPABASE_URL: 'http://localhost',
  supabase: { from: vi.fn(() => chain()), rpc: vi.fn() },
}))

const { setDayPrice } = await import('@/api/menu')

beforeEach(() => {
  updates.length = 0
})

describe('вартість блюда', () => {
  it('кладе суму на один компонент, решті ставить null', async () => {
    rows = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

    await setDayPrice('2026-09-01', 62.5)

    expect(updates).toHaveLength(2)
    expect(updates[0]).toEqual({ price: 62.5, ids: ['a'] })
    expect(updates[1]).toEqual({ price: null, ids: ['b', 'c'] })
  })

  it('з одним компонентом другого запиту не робить', async () => {
    rows = [{ id: 'a' }]

    await setDayPrice('2026-09-01', 40)

    expect(updates).toEqual([{ price: 40, ids: ['a'] }])
  })

  it('порожній день не чіпає', async () => {
    rows = []

    await setDayPrice('2026-09-01', 40)

    expect(updates).toHaveLength(0)
  })

  it('очищення ціни теж лягає на один компонент', async () => {
    rows = [{ id: 'a' }, { id: 'b' }]

    await setDayPrice('2026-09-01', null)

    expect(updates[0]).toEqual({ price: null, ids: ['a'] })
    expect(updates[1]).toEqual({ price: null, ids: ['b'] })
  })
})
