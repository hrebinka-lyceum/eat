import { describe, expect, it } from 'vitest'
import {
  buildGenderBreakdown,
  buildOrganizationReport,
  sumGender,
  tallyGender,
  UNCATEGORIZED_LABEL,
  type ClassRef,
  type MealRow,
} from '@/lib/mealReport'

const YEAR = '2026/2027'
const klass = (id: string, name: string, total: number | null = 25, year = YEAR): ClassRef => ({
  id,
  name,
  academic_year: year,
  total_students: total,
})
const CLASSES = [klass('c1', '1-А', 20), klass('c5', '5-А', 25), klass('c10', '10-А', null), klass('c2', '2-А', 22)]
const CATEGORIES = [
  { id: 'vpo', name: 'ВПО' },
  { id: 'big', name: 'Багатодітні' },
]

const row = (over: Partial<MealRow>): MealRow => ({
  menu_date: '2026-10-01',
  student_id: 's1',
  class_id: 'c1',
  privileged: false,
  cost: 50,
  unpriced: false,
  gender: 'female',
  category_ids: [],
  ...over,
})

describe('buildOrganizationReport', () => {
  // Дітей — різних учнів, а не замовлень: одна дитина за місяць — це двадцять
  // замовлень, але одна дитина.
  it('рахує дітей, а не замовлення', () => {
    const report = buildOrganizationReport(
      [
        row({ student_id: 's1', menu_date: '2026-10-01' }),
        row({ student_id: 's1', menu_date: '2026-10-02' }),
        row({ student_id: 's2', menu_date: '2026-10-02', cost: 60 }),
      ],
      CLASSES,
      CATEGORIES,
      { currentYear: YEAR },
    )
    expect(report.days).toBe(2)
    expect(report.children).toBe(2)
    expect(report.cost).toBe(160)
    expect(report.avgPerChild).toBe(80)
  })

  it('розкладає дітей і гроші за ланками 1–4, 5–9, 10–11', () => {
    const report = buildOrganizationReport(
      [
        row({ student_id: 'a', class_id: 'c1', cost: 40 }),
        row({ student_id: 'b', class_id: 'c2', cost: 40 }),
        row({ student_id: 'c', class_id: 'c5', cost: 55 }),
        row({ student_id: 'd', class_id: 'c10', cost: 60, gender: 'male' }),
      ],
      CLASSES,
      CATEGORIES,
      { currentYear: YEAR },
    )
    const [primary, middle, senior] = report.levels
    expect(primary).toMatchObject({ level: 'primary', children: 2, cost: 80, avgPerChild: 40 })
    expect(middle).toMatchObject({ level: 'middle', children: 1, cost: 55 })
    expect(senior).toMatchObject({ level: 'senior', children: 1, cost: 60 })
    expect(senior.gender).toEqual({ male: 1, female: 0, unknown: 0, total: 1 })
    expect(report.levelsTotal).toMatchObject({ children: 4, cost: 195 })
  })

  it('порожня ланка має нулі, а не ділення на нуль', () => {
    const report = buildOrganizationReport([row({})], CLASSES, CATEGORIES, { currentYear: YEAR })
    expect(report.levels[2]).toMatchObject({ children: 0, cost: 0, avgPerChild: null })
  })

  it('відвідування: класи в природному порядку, пільговики окремо', () => {
    const report = buildOrganizationReport(
      [
        row({ student_id: 'a', class_id: 'c1' }),
        row({ student_id: 'b', class_id: 'c1', privileged: true, category_ids: ['vpo'] }),
        row({ student_id: 'b', class_id: 'c1', privileged: true, category_ids: ['vpo'], menu_date: '2026-10-02' }),
      ],
      CLASSES,
      CATEGORIES,
      { currentYear: YEAR },
    )
    expect(report.attendance.map((r) => r.name)).toEqual(['1-А', '2-А', '5-А', '10-А'])
    expect(report.attendance[0]).toMatchObject({ total: 20, ate: 2, privileged: 1, coveragePct: 10 })
    // Клас без жодного замовлення — теж відповідь, його видно з нулем.
    expect(report.attendance[1]).toMatchObject({ name: '2-А', ate: 0, coveragePct: 0 })
  })

  // Пастка, на якій уже раз показали 118,5%: підсумковий відсоток рахується
  // лише по класах, де відома загальна кількість — і чисельник, і знаменник.
  it('підсумкове охоплення не враховує класів без загальної кількості', () => {
    const report = buildOrganizationReport(
      [
        ...Array.from({ length: 10 }, (_, i) => row({ student_id: `p${i}`, class_id: 'c1' })),
        ...Array.from({ length: 30 }, (_, i) => row({ student_id: `s${i}`, class_id: 'c10' })),
      ],
      [klass('c1', '1-А', 20), klass('c10', '10-А', null)],
      CATEGORIES,
      { currentYear: YEAR },
    )
    expect(report.attendance[1]).toMatchObject({ total: null, ate: 30, coveragePct: null })
    expect(report.attendanceTotal).toMatchObject({ total: 20, ate: 40, coveragePct: 50 })
  })

  it('показує клас минулого року, якщо в ньому були замовлення за період', () => {
    const report = buildOrganizationReport(
      [row({ class_id: 'old' })],
      [...CLASSES, klass('old', '4-Б', 20, '2025/2026'), klass('gone', '4-В', 20, '2025/2026')],
      CATEGORIES,
      { currentYear: YEAR },
    )
    const names = report.attendance.map((r) => r.name)
    expect(names).toContain('4-Б')
    expect(names).not.toContain('4-В')
  })

  it('пільгові категорії: діти, дні й вартість; без категорії — в кінці', () => {
    const report = buildOrganizationReport(
      [
        row({ student_id: 'a', privileged: true, category_ids: ['vpo'], cost: 50 }),
        row({ student_id: 'a', privileged: true, category_ids: ['vpo'], cost: 50, menu_date: '2026-10-02' }),
        row({ student_id: 'b', privileged: true, category_ids: ['big'], cost: 50 }),
        row({ student_id: 'c', privileged: true, category_ids: [], cost: 50 }),
        row({ student_id: 'd', privileged: false, cost: 50 }),
      ],
      CLASSES,
      CATEGORIES,
      { currentYear: YEAR },
    )
    expect(report.categories).toEqual([
      { id: 'big', name: 'Багатодітні', children: 1, portions: 1, alsoChildren: 0 },
      { id: 'vpo', name: 'ВПО', children: 1, portions: 2, alsoChildren: 0 },
      { id: null, name: UNCATEGORIZED_LABEL, children: 1, portions: 1, alsoChildren: 0 },
    ])
    expect(report.categoriesTotal).toEqual({ children: 3, portions: 4 })
    expect(report.categoriesOverlap).toBe(false)
  })

  // Дитина з кількома категоріями — один пільговик: рахується лише за першою
  // категорією, а решта видно окремо, «(+N)», і в підсумок не йде. Інакше
  // пільговиків у звіті стало б більше, ніж їх є.
  it('дитину з кількома категоріями рахує лише за першою', () => {
    const report = buildOrganizationReport(
      [
        row({ student_id: 'a', privileged: true, category_ids: ['vpo', 'big'] }),
        row({ student_id: 'a', privileged: true, category_ids: ['vpo', 'big'], menu_date: '2026-10-02' }),
        row({ student_id: 'b', privileged: true, category_ids: ['big'] }),
      ],
      CLASSES,
      CATEGORIES,
      { currentYear: YEAR },
    )
    expect(report.categories).toEqual([
      { id: 'big', name: 'Багатодітні', children: 1, portions: 1, alsoChildren: 1 },
      { id: 'vpo', name: 'ВПО', children: 1, portions: 2, alsoChildren: 0 },
    ])
    expect(report.categoriesTotal).toEqual({ children: 2, portions: 3 })
    const sum = report.categories.reduce((acc, r) => acc + r.children, 0)
    expect(sum).toBe(report.categoriesTotal.children)
    expect(report.categoriesOverlap).toBe(true)
  })

  it('категорія, що стоїть лише другою, теж видна — з нулем і «(+N)»', () => {
    const report = buildOrganizationReport(
      [row({ student_id: 'a', privileged: true, category_ids: ['vpo', 'big'] })],
      CLASSES,
      CATEGORIES,
      { currentYear: YEAR },
    )
    expect(report.categories.find((r) => r.id === 'big')).toMatchObject({ children: 0, portions: 0, alsoChildren: 1 })
  })

  it('рахує замовлення на дні без вартості', () => {
    const report = buildOrganizationReport(
      [row({ unpriced: true, cost: 0 }), row({ student_id: 's2' })],
      CLASSES,
      CATEGORIES,
      { currentYear: YEAR },
    )
    expect(report.unpricedOrders).toBe(1)
  })

  it('копійки не накопичують похибку', () => {
    const report = buildOrganizationReport(
      Array.from({ length: 3 }, (_, i) => row({ student_id: `s${i}`, cost: 0.1 })),
      CLASSES,
      CATEGORIES,
      { currentYear: YEAR },
    )
    expect(report.cost).toBe(0.3)
    expect(report.avgPerChild).toBe(0.1)
  })
})

describe('buildGenderBreakdown', () => {
  it('рахує хлопців і дівчат по класах, ланках і школі', () => {
    const breakdown = buildGenderBreakdown(
      [
        row({ student_id: 'a', class_id: 'c1', gender: 'male' }),
        row({ student_id: 'a', class_id: 'c1', gender: 'male', menu_date: '2026-10-02' }),
        row({ student_id: 'b', class_id: 'c1', gender: 'female' }),
        row({ student_id: 'c', class_id: 'c5', gender: null }),
      ],
      CLASSES,
      { currentYear: YEAR },
    )
    expect(breakdown.classes[0]).toMatchObject({ name: '1-А', counts: { male: 1, female: 1, unknown: 0, total: 2 } })
    expect(breakdown.levels.map((l) => l.counts.total)).toEqual([2, 1, 0])
    expect(breakdown.total).toEqual({ male: 1, female: 1, unknown: 1, total: 3 })
  })
})

describe('tallyGender', () => {
  it('рахує замовлення хлопців і дівчат за ключем', () => {
    const rows = [
      { class_id: 'c1', gender: 'male' as const },
      { class_id: 'c1', gender: 'female' as const },
      { class_id: 'c1', gender: 'female' as const },
      { class_id: 'c2', gender: null },
    ]
    const byClass = tallyGender(rows, (r) => r.class_id)
    expect(byClass.get('c1')).toEqual({ male: 1, female: 2, unknown: 0, total: 3 })
    expect(byClass.get('c2')).toEqual({ male: 0, female: 0, unknown: 1, total: 1 })
    expect(sumGender(byClass.values())).toEqual({ male: 1, female: 2, unknown: 1, total: 4 })
  })
})
