// ---------------------------------------------------------------------------
//  Арифметика звітів.
//
//  Винесена з компонентів навмисно: саме тут ховаються помилки, які на око
//  не видно (одного разу підсумок охоплення показав 118,5%), і саме її
//  найдешевше закрити тестами.
// ---------------------------------------------------------------------------
import { compareClassNames } from './grades'

// Список класу — це всі учні класу (і ті, хто не харчується), тож розмір
// класу — це кількість учнів у списку на день (students_registered), а не
// число, яке окремо вписувала адміністрація. Охоплення одне: яка частка
// класу замовила.

export interface CoverageDay {
  class_id: string
  class_name: string
  students_registered: number
  students_ordered: number
}

export interface CoverageClass {
  class_id: string
  class_name: string
  /** учнів у класі за останній день періоду — найсвіжіше число */
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
      registered: day.students_registered,
      ordered_sum: 0,
      registered_sum: 0,
      days: 0,
    }
    current.ordered_sum += day.students_ordered
    current.registered_sum += day.students_registered
    current.days += 1
    current.registered = day.students_registered
    map.set(day.class_id, current)
  }

  return [...map.values()].sort((a, b) => compareClassNames(a.class_name, b.class_name))
}

/**
 * Охоплення: яка частка класу замовила. Рахується від сум за період, а не
 * як середнє денних відсотків: інакше день з одним присутнім важив би
 * стільки ж, скільки повний.
 */
export function coverageRegisteredPct(row: CoverageClass): number | null {
  return row.registered_sum === 0 ? null : (row.ordered_sum / row.registered_sum) * 100
}

export function coverageAveragePerDay(row: CoverageClass): number {
  return row.days === 0 ? 0 : row.ordered_sum / row.days
}

export interface CoverageTotals {
  registered: number
  ordered_sum: number
  registered_sum: number
  days: number
}

export function coverageTotals(rows: CoverageClass[]): CoverageTotals {
  return rows.reduce<CoverageTotals>(
    (acc, row) => ({
      registered: acc.registered + row.registered,
      ordered_sum: acc.ordered_sum + row.ordered_sum,
      registered_sum: acc.registered_sum + row.registered_sum,
      days: Math.max(acc.days, row.days),
    }),
    { registered: 0, ordered_sum: 0, registered_sum: 0, days: 0 },
  )
}

export function coverageTotalRegisteredPct(totals: CoverageTotals): number | null {
  return totals.registered_sum === 0 ? null : (totals.ordered_sum / totals.registered_sum) * 100
}

// --- Відшкодування ---------------------------------------------------------

export interface CostRow {
  class_id: string
  privileged: boolean
  cost: number
  unpriced: boolean
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
 * Розкладає замовлення по класах і за ознакою пільги. Окремо рахує замовлення
 * без вартості: вони додають до суми нуль, і без попередження звіт занизив би
 * відшкодування.
 */
export function aggregateReimbursement(
  orders: CostRow[],
  classNameOf: (classId: string) => string,
): { rows: ReimbursementRow[]; unpricedOrders: number } {
  const map = new Map<string, ReimbursementRow>()
  let unpricedOrders = 0

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
    if (order.unpriced) unpricedOrders += 1
    map.set(order.class_id, current)
  }

  return {
    rows: [...map.values()].sort((a, b) => compareClassNames(a.class_name, b.class_name)),
    unpricedOrders,
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
