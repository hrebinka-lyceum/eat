// ---------------------------------------------------------------------------
//  Арифметика звітів.
//
//  Винесена з компонентів навмисно: саме тут ховаються помилки, які на око
//  не видно (одного разу підсумок охоплення показав 118,5%), і саме її
//  найдешевше закрити тестами.
// ---------------------------------------------------------------------------

export interface CoverageDay {
  class_id: string
  class_name: string
  total_students: number | null
  students_registered: number
  students_ordered: number
}

export interface CoverageClass {
  class_id: string
  class_name: string
  total_students: number | null
  /** скільки в реєстрі за останній день періоду — найсвіжіше число */
  registered: number
  ordered_sum: number
  registered_sum: number
  days: number
}

/** Згортає денні рядки v_class_coverage у рядки по класах. */
export function aggregateCoverage(days: CoverageDay[]): CoverageClass[] {
  const map = new Map<string, CoverageClass>()

  for (const day of days) {
    const current = map.get(day.class_id) ?? {
      class_id: day.class_id,
      class_name: day.class_name,
      total_students: day.total_students,
      registered: day.students_registered,
      ordered_sum: 0,
      registered_sum: 0,
      days: 0,
    }
    current.ordered_sum += day.students_ordered
    current.registered_sum += day.students_registered
    current.days += 1
    current.registered = day.students_registered
    current.total_students = day.total_students
    map.set(day.class_id, current)
  }

  return [...map.values()].sort((a, b) => a.class_name.localeCompare(b.class_name, 'uk'))
}

/**
 * Скільки з тих, хто харчується, замовили. Рахується від сум за період,
 * а не як середнє денних відсотків: інакше день з одним присутнім важив би
 * стільки ж, скільки повний.
 */
export function coverageRegisteredPct(row: CoverageClass): number | null {
  return row.registered_sum === 0 ? null : (row.ordered_sum / row.registered_sum) * 100
}

/** Яка частка класу взагалі в реєстрі харчування. */
export function coverageClassPct(row: CoverageClass): number | null {
  return row.total_students ? (row.registered / row.total_students) * 100 : null
}

export function coverageAveragePerDay(row: CoverageClass): number {
  return row.days === 0 ? 0 : row.ordered_sum / row.days
}

export interface CoverageTotals {
  total_students: number
  registered: number
  ordered_sum: number
  registered_sum: number
  days: number
  /** класи без указаного розміру — їх не можна брати лише в чисельник */
  unsized: CoverageClass[]
}

export function coverageTotals(rows: CoverageClass[]): CoverageTotals {
  return rows.reduce<CoverageTotals>(
    (acc, row) => ({
      total_students: acc.total_students + (row.total_students ?? 0),
      registered: acc.registered + row.registered,
      ordered_sum: acc.ordered_sum + row.ordered_sum,
      registered_sum: acc.registered_sum + row.registered_sum,
      days: Math.max(acc.days, row.days),
      unsized: row.total_students === null ? [...acc.unsized, row] : acc.unsized,
    }),
    {
      total_students: 0,
      registered: 0,
      ordered_sum: 0,
      registered_sum: 0,
      days: 0,
      unsized: [],
    },
  )
}

/** Підсумковий відсоток реєстру — лише по класах із відомим розміром. */
export function coverageTotalClassPct(rows: CoverageClass[]): number | null {
  const sized = rows.filter((row) => row.total_students !== null)
  const total = sized.reduce((sum, row) => sum + (row.total_students ?? 0), 0)
  if (total === 0) return null
  const registered = sized.reduce((sum, row) => sum + row.registered, 0)
  return (registered / total) * 100
}

export function coverageTotalRegisteredPct(totals: CoverageTotals): number | null {
  return totals.registered_sum === 0 ? null : (totals.ordered_sum / totals.registered_sum) * 100
}

// --- Відшкодування ---------------------------------------------------------

export interface CostRow {
  class_id: string
  privileged: boolean
  cost: number
  missing_prices: number
}

export interface ReimbursementRow {
  class_id: string
  class_name: string
  privileged_portions: number
  privileged_cost: number
  regular_portions: number
  regular_cost: number
}

/**
 * Розкладає замовлення по класах і за ознакою пільги. Окремо рахує позиції
 * без ціни: вони додають до суми нуль, і без попередження звіт занизив би
 * відшкодування.
 */
export function aggregateReimbursement(
  orders: CostRow[],
  classNameOf: (classId: string) => string,
): { rows: ReimbursementRow[]; missingPrices: number } {
  const map = new Map<string, ReimbursementRow>()
  let missingPrices = 0

  for (const order of orders) {
    const current = map.get(order.class_id) ?? {
      class_id: order.class_id,
      class_name: classNameOf(order.class_id),
      privileged_portions: 0,
      privileged_cost: 0,
      regular_portions: 0,
      regular_cost: 0,
    }

    if (order.privileged) {
      current.privileged_portions += 1
      current.privileged_cost += order.cost
    } else {
      current.regular_portions += 1
      current.regular_cost += order.cost
    }
    missingPrices += order.missing_prices
    map.set(order.class_id, current)
  }

  return {
    rows: [...map.values()].sort((a, b) => a.class_name.localeCompare(b.class_name, 'uk')),
    missingPrices,
  }
}

export function reimbursementTotals(rows: ReimbursementRow[]) {
  return rows.reduce(
    (acc, row) => ({
      privileged_portions: acc.privileged_portions + row.privileged_portions,
      privileged_cost: acc.privileged_cost + row.privileged_cost,
      regular_portions: acc.regular_portions + row.regular_portions,
      regular_cost: acc.regular_cost + row.regular_cost,
    }),
    { privileged_portions: 0, privileged_cost: 0, regular_portions: 0, regular_cost: 0 },
  )
}
