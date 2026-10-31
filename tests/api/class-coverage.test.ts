import { describe, expect, it, vi } from 'vitest'

/**
 * Охоплення — рядок на кожен день × клас. Квартал з 25 класами — це вже
 * понад тисячу рядків, а Supabase за замовчуванням віддає не більше 1000.
 * Без читання частинами звіт про організацію харчування мовчки втратив би
 * частину класів. Заглушка ріже відповідь так само, як сервер.
 */
const { server } = vi.hoisted(() => ({ server: { rows: [] as unknown[], maxRows: 1000 } }))

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
    const [from, to] = range ?? [0, Number.MAX_SAFE_INTEGER]
    return resolve({ data: server.rows.slice(from, Math.min(to + 1, from + server.maxRows)), error: null })
  }
  return builder
}

vi.mock('@/lib/supabase', () => ({
  SUPABASE_URL: 'http://localhost',
  supabase: { from: vi.fn(() => chain()), rpc: vi.fn() },
}))

const { classCoverage } = await import('@/api/stats')

describe('classCoverage', () => {
  it('читає всі рядки, а не першу тисячу', async () => {
    // 66 днів × 25 класів = 1650 рядків
    server.rows = Array.from({ length: 1650 }, (_, i) => ({
      menu_date: `2026-${String(9 + Math.floor(i / 25 / 22)).padStart(2, '0')}-${String((Math.floor(i / 25) % 22) + 1).padStart(2, '0')}`,
      class_id: `c${i % 25}`,
      class_name: `${(i % 11) + 1}-А`,
      students_registered: 25,
      students_ordered: 20,
    }))

    const rows = await classCoverage('2026-09-01', '2026-11-30')

    expect(rows).toHaveLength(1650)
  })
})
