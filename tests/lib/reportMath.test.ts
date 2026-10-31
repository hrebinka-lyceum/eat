import { describe, expect, it } from 'vitest'
import {
  aggregateCoverage,
  aggregateReimbursement,
  coverageAveragePerDay,
  coverageRegisteredPct,
  coverageTotalRegisteredPct,
  coverageTotals,
  reimbursementTotals,
  type CoverageDay,
} from '@/lib/reportMath'

const day = (over: Partial<CoverageDay> & Pick<CoverageDay, 'class_id'>): CoverageDay => ({
  class_name: over.class_id,
  students_registered: 20,
  students_ordered: 10,
  ...over,
})

describe('охоплення', () => {
  it('згортає дні в рядки по класах', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А', students_ordered: 10 }),
      day({ class_id: '7-А', students_ordered: 14 }),
      day({ class_id: '7-Б' }),
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].class_id).toBe('7-А')
    expect(rows[0].ordered_sum).toBe(24)
    expect(rows[0].days).toBe(2)
  })

  // Розмір класу — зі списку класу (учні змінюються: прийшли, вибули),
  // тож береться найсвіжіше число, а не середнє.
  it('бере кількість учнів у класі за останній день, а не середню', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А', students_registered: 20 }),
      day({ class_id: '7-А', students_registered: 22 }),
    ])
    expect(rows[0].registered).toBe(22)
  })

  // Пастка: якщо усереднювати денні відсотки, день з одним присутнім
  // важить стільки ж, скільки повний.
  it('відсоток рахується від сум, а не як середнє денних відсотків', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А', students_registered: 1, students_ordered: 1 }), // 100%
      day({ class_id: '7-А', students_registered: 99, students_ordered: 49 }), // ~49.5%
    ])
    // сума: 50/100 = 50%, а не (100 + 49.5) / 2 = 74.75%
    expect(coverageRegisteredPct(rows[0])).toBeCloseTo(50, 5)
  })

  it('середнє за день', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А', students_ordered: 10 }),
      day({ class_id: '7-А', students_ordered: 20 }),
    ])
    expect(coverageAveragePerDay(rows[0])).toBe(15)
  })

  // Список класу — усі учні, тож охоплення не може перевищити 100%:
  // замовити може лише той, хто є в списку.
  it('підсумкове охоплення школи — від сум усіх класів', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А', students_registered: 28, students_ordered: 21 }),
      day({ class_id: '7-Б', students_registered: 26, students_ordered: 19 }),
    ])
    const totals = coverageTotals(rows)
    expect(totals.registered).toBe(54)
    expect(coverageTotalRegisteredPct(totals)).toBeCloseTo((21 + 19) / (28 + 26) * 100, 5)
  })

  it('підсумковий відсоток замовлень — теж від сум', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А', students_registered: 20, students_ordered: 10 }),
      day({ class_id: '7-Б', students_registered: 30, students_ordered: 15 }),
    ])
    expect(coverageTotalRegisteredPct(coverageTotals(rows))).toBeCloseTo(50, 5)
  })

  it('порожній період не ділить на нуль', () => {
    expect(coverageTotalRegisteredPct(coverageTotals([]))).toBeNull()
  })
})

describe('відшкодування', () => {
  const nameOf = (id: string) => ({ c1: '7-А', c2: '7-Б' })[id] ?? '—'

  it('ділить порції й суми на пільгові та звичайні', () => {
    const { rows } = aggregateReimbursement(
      [
        { class_id: 'c1', privileged: true, cost: 60, unpriced: false },
        { class_id: 'c1', privileged: false, cost: 40, unpriced: false },
        { class_id: 'c1', privileged: false, cost: 40, unpriced: false },
      ],
      nameOf,
    )
    expect(rows[0]).toMatchObject({
      class_name: '7-А',
      privileged_portions: 1,
      privileged_cost: 60,
      regular_portions: 2,
      regular_cost: 80,
    })
  })

  // Пастка: замовлення на день без вартості блюда додає нуль, і звіт
  // мовчки занижує відшкодування.
  it('рахує замовлення без вартості окремо', () => {
    const { unpricedOrders } = aggregateReimbursement(
      [
        { class_id: 'c1', privileged: false, cost: 0, unpriced: true },
        { class_id: 'c1', privileged: false, cost: 58, unpriced: false },
        { class_id: 'c2', privileged: true, cost: 0, unpriced: true },
      ],
      nameOf,
    )
    expect(unpricedOrders).toBe(2)
  })

  it('сортує класи за назвою', () => {
    const { rows } = aggregateReimbursement(
      [
        { class_id: 'c2', privileged: false, cost: 1, unpriced: false },
        { class_id: 'c1', privileged: false, cost: 1, unpriced: false },
      ],
      nameOf,
    )
    expect(rows.map((r) => r.class_name)).toEqual(['7-А', '7-Б'])
  })

  it('ставить 2-А перед 10-А', () => {
    const names: Record<string, string> = { a: '10-А', b: '2-А', c: '1-А' }
    const { rows } = aggregateReimbursement(
      ['a', 'b', 'c'].map((id) => ({ class_id: id, privileged: false, cost: 1, unpriced: false })),
      (id) => names[id],
    )
    expect(rows.map((r) => r.class_name)).toEqual(['1-А', '2-А', '10-А'])
  })

  it('підсумок збігається із сумою рядків', () => {
    const { rows } = aggregateReimbursement(
      [
        { class_id: 'c1', privileged: true, cost: 60, unpriced: false },
        { class_id: 'c2', privileged: false, cost: 40, unpriced: false },
      ],
      nameOf,
    )
    expect(reimbursementTotals(rows)).toEqual({
      privileged_portions: 1,
      privileged_cost: 60,
      regular_portions: 1,
      regular_cost: 40,
    })
  })
})
