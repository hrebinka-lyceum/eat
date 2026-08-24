import { describe, expect, it } from 'vitest'
import {
  aggregateCoverage,
  aggregateReimbursement,
  coverageAveragePerDay,
  coverageClassPct,
  coverageRegisteredPct,
  coverageTotalClassPct,
  coverageTotalRegisteredPct,
  coverageTotals,
  reimbursementTotals,
  type CoverageDay,
} from '@/lib/reportMath'

const day = (over: Partial<CoverageDay> & Pick<CoverageDay, 'class_id'>): CoverageDay => ({
  class_name: over.class_id,
  total_students: 28,
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

  it('бере розмір реєстру за останній день, а не середній', () => {
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

  it('частка класу порожня без указаного розміру', () => {
    const [withSize, without] = aggregateCoverage([
      day({ class_id: '7-А', total_students: 28, students_registered: 21 }),
      day({ class_id: '8-А', total_students: null, students_registered: 24 }),
    ])
    expect(coverageClassPct(withSize)).toBeCloseTo(75, 5)
    expect(coverageClassPct(without)).toBeNull()
  })

  it('середнє за день', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А', students_ordered: 10 }),
      day({ class_id: '7-А', students_ordered: 20 }),
    ])
    expect(coverageAveragePerDay(rows[0])).toBe(15)
  })

  // Регресія: підсумок показував 118,5%, бо клас без розміру потрапляв
  // у чисельник, але не в знаменник.
  it('підсумковий відсоток не перевищує 100 через класи без розміру', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А', total_students: 28, students_registered: 21 }),
      day({ class_id: '7-Б', total_students: 26, students_registered: 19 }),
      day({ class_id: '8-А', total_students: null, students_registered: 24 }),
    ])
    const pct = coverageTotalClassPct(rows)!
    expect(pct).toBeCloseTo((21 + 19) / (28 + 26) * 100, 5)
    expect(pct).toBeLessThanOrEqual(100)
  })

  it('підсумок називає класи без розміру', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А' }),
      day({ class_id: '8-А', total_students: null }),
    ])
    expect(coverageTotals(rows).unsized.map((r) => r.class_id)).toEqual(['8-А'])
  })

  it('підсумковий відсоток замовлень — теж від сум', () => {
    const rows = aggregateCoverage([
      day({ class_id: '7-А', students_registered: 20, students_ordered: 10 }),
      day({ class_id: '7-Б', students_registered: 30, students_ordered: 15 }),
    ])
    expect(coverageTotalRegisteredPct(coverageTotals(rows))).toBeCloseTo(50, 5)
  })

  it('порожній період не ділить на нуль', () => {
    expect(coverageTotalClassPct([])).toBeNull()
    expect(coverageTotalRegisteredPct(coverageTotals([]))).toBeNull()
  })
})

describe('відшкодування', () => {
  const nameOf = (id: string) => ({ c1: '7-А', c2: '7-Б' })[id] ?? '—'

  it('ділить порції й суми на пільгові та звичайні', () => {
    const { rows } = aggregateReimbursement(
      [
        { class_id: 'c1', privileged: true, cost: 60, missing_prices: 0 },
        { class_id: 'c1', privileged: false, cost: 40, missing_prices: 0 },
        { class_id: 'c1', privileged: false, cost: 40, missing_prices: 0 },
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

  // Пастка: страва без ціни додає нуль, і звіт мовчки занижує відшкодування.
  it('рахує позиції без ціни окремо', () => {
    const { missingPrices } = aggregateReimbursement(
      [
        { class_id: 'c1', privileged: false, cost: 24, missing_prices: 2 },
        { class_id: 'c2', privileged: false, cost: 30, missing_prices: 1 },
      ],
      nameOf,
    )
    expect(missingPrices).toBe(3)
  })

  it('сортує класи за назвою', () => {
    const { rows } = aggregateReimbursement(
      [
        { class_id: 'c2', privileged: false, cost: 1, missing_prices: 0 },
        { class_id: 'c1', privileged: false, cost: 1, missing_prices: 0 },
      ],
      nameOf,
    )
    expect(rows.map((r) => r.class_name)).toEqual(['7-А', '7-Б'])
  })

  it('підсумок збігається із сумою рядків', () => {
    const { rows } = aggregateReimbursement(
      [
        { class_id: 'c1', privileged: true, cost: 60, missing_prices: 0 },
        { class_id: 'c2', privileged: false, cost: 40, missing_prices: 0 },
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
