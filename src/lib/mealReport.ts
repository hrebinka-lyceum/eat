// ---------------------------------------------------------------------------
//  Зведений звіт про організацію харчування і розріз за статтю.
//
//  Рахує з рядків замовлень (api/reports → mealOrders). «Дітей» скрізь —
//  різних учнів, які харчувалися хоча б день за період, а не кількість
//  замовлень: одна дитина за місяць — це двадцять замовлень, але одна дитина.
// ---------------------------------------------------------------------------
import { compareClassNames, SCHOOL_LEVELS, schoolLevel, type SchoolLevel } from './grades'
import type { Gender } from '@/types/database'

export interface MealRow {
  menu_date: string
  student_id: string
  class_id: string
  privileged: boolean
  cost: number
  unpriced: boolean
  gender: Gender | null
  /** поточні категорії учня; порожньо в пільговика — пільга без категорії */
  category_ids: string[]
}

export interface ClassRef {
  id: string
  name: string
  academic_year: string
  total_students: number | null
}

export interface CategoryRef {
  id: string
  name: string
}

export interface GenderCounts {
  male: number
  female: number
  unknown: number
  total: number
}

export interface LevelRow {
  level: SchoolLevel
  label: string
  grades: string
  children: number
  cost: number
  avgPerChild: number | null
  gender: GenderCounts
}

export interface AttendanceRow {
  classId: string
  name: string
  /** скільки учнів у класі взагалі; null — адміністрація не вказала */
  total: number | null
  ate: number
  privileged: number
  coveragePct: number | null
}

export interface CategoryRow {
  /** null — пільга без категорії (поставлена до появи категорій) */
  id: string | null
  name: string
  /** діти, для яких це перша категорія — лише вони йдуть у підсумок */
  children: number
  /** днів харчування цих дітей — пільгових замовлень */
  portions: number
  /** діти, що мають цю категорію не першою: уже враховані в іншому рядку */
  alsoChildren: number
}

export interface OrganizationReport {
  days: number
  children: number
  cost: number
  avgPerChild: number | null
  /** замовлення на дні без вартості блюда: додають до суми нуль */
  unpricedOrders: number
  levels: LevelRow[]
  levelsTotal: Omit<LevelRow, 'level' | 'label' | 'grades'>
  attendance: AttendanceRow[]
  attendanceTotal: {
    /** сума лише по класах, де відома загальна кількість учнів */
    total: number | null
    ate: number
    privileged: number
    coveragePct: number | null
  }
  categories: CategoryRow[]
  /** сума рядків: кожна дитина й кожне замовлення — один раз */
  categoriesTotal: { children: number; portions: number }
  /** чи є діти з кількома категоріями — тоді в рядках з'являються «(+N)» */
  categoriesOverlap: boolean
}

export const UNCATEGORIZED_LABEL = 'Категорію не вказано'

const round2 = (value: number) => Math.round(value * 100) / 100
const average = (cost: number, children: number) => (children === 0 ? null : round2(cost / children))

function genderOf(rows: Iterable<{ student_id: string; gender: Gender | null }>): GenderCounts {
  const byStudent = new Map<string, Gender | null>()
  for (const row of rows) byStudent.set(row.student_id, row.gender)
  const counts: GenderCounts = { male: 0, female: 0, unknown: 0, total: 0 }
  for (const gender of byStudent.values()) {
    counts[gender ?? 'unknown'] += 1
    counts.total += 1
  }
  return counts
}

function distinctStudents(rows: MealRow[]): number {
  return new Set(rows.map((row) => row.student_id)).size
}

function sumCost(rows: MealRow[]): number {
  return round2(rows.reduce((sum, row) => sum + row.cost, 0))
}

function groupBy<K>(rows: MealRow[], key: (row: MealRow) => K): Map<K, MealRow[]> {
  const map = new Map<K, MealRow[]>()
  for (const row of rows) {
    const k = key(row)
    const list = map.get(k)
    if (list) list.push(row)
    else map.set(k, [row])
  }
  return map
}

/**
 * Які класи показувати: усі класи поточного року (навіть ті, де ніхто не
 * харчувався — це теж відповідь) і будь-який клас, у якому були замовлення
 * за період (період може зачепити минулий навчальний рік).
 */
function visibleClasses(rows: MealRow[], classes: ClassRef[], currentYear: string): ClassRef[] {
  const withOrders = new Set(rows.map((row) => row.class_id))
  return classes
    .filter((klass) => klass.academic_year === currentYear || withOrders.has(klass.id))
    .sort((a, b) => compareClassNames(a.name, b.name))
}

export function buildOrganizationReport(
  rows: MealRow[],
  classes: ClassRef[],
  categories: CategoryRef[],
  { currentYear }: { currentYear: string },
): OrganizationReport {
  const classById = new Map(classes.map((klass) => [klass.id, klass]))
  const children = distinctStudents(rows)
  const cost = sumCost(rows)

  // --- Ланки ---------------------------------------------------------------
  const levelOf = (row: MealRow) => {
    const klass = classById.get(row.class_id)
    return klass ? schoolLevel(klass.name) : null
  }
  const byLevel = groupBy(rows, levelOf)
  const levels: LevelRow[] = SCHOOL_LEVELS.map(({ level, label, grades }) => {
    const list = byLevel.get(level) ?? []
    const levelChildren = distinctStudents(list)
    const levelCost = sumCost(list)
    return {
      level,
      label,
      grades,
      children: levelChildren,
      cost: levelCost,
      avgPerChild: average(levelCost, levelChildren),
      gender: genderOf(list),
    }
  })
  const inLevels = rows.filter((row) => levelOf(row) !== null)
  const levelsChildren = distinctStudents(inLevels)
  const levelsCost = sumCost(inLevels)

  // --- Відвідування по класах ---------------------------------------------
  const byClass = groupBy(rows, (row) => row.class_id)
  const attendance: AttendanceRow[] = visibleClasses(rows, classes, currentYear).map((klass) => {
    const list = byClass.get(klass.id) ?? []
    const ate = distinctStudents(list)
    const privileged = distinctStudents(list.filter((row) => row.privileged))
    const total = klass.total_students && klass.total_students > 0 ? klass.total_students : null
    return {
      classId: klass.id,
      name: klass.name,
      total,
      ate,
      privileged,
      coveragePct: total === null ? null : round1((ate / total) * 100),
    }
  })
  // Відсоток підсумку — лише по класах із відомою загальною кількістю, і
  // чисельник, і знаменник. Інакше вийде як колись: охоплення 118,5%.
  const known = attendance.filter((row) => row.total !== null)
  const knownTotal = known.reduce((sum, row) => sum + (row.total ?? 0), 0)
  const knownAte = known.reduce((sum, row) => sum + row.ate, 0)

  // --- Пільгові категорії ---------------------------------------------------
  const categoryName = new Map(categories.map((category) => [category.id, category.name]))
  const privilegedRows = rows.filter((row) => row.privileged)
  // Дитина рахується лише за ПЕРШОЮ категорією — інакше пільговиків у звіті
  // стало б більше, ніж їх є. Решту її категорій показуємо окремо, «(+N)».
  const byCategory = groupBy<string | null>(privilegedRows, (row) => row.category_ids[0] ?? null)
  const alsoIn = new Map<string, Set<string>>()
  for (const row of privilegedRows) {
    for (const id of row.category_ids.slice(1)) {
      const set = alsoIn.get(id) ?? new Set<string>()
      set.add(row.student_id)
      alsoIn.set(id, set)
    }
  }
  const categoryIds = new Set<string | null>([...byCategory.keys(), ...alsoIn.keys()])
  const categoryRows: CategoryRow[] = [...categoryIds]
    .map((id) => {
      const list = byCategory.get(id) ?? []
      return {
        id,
        name: id === null ? UNCATEGORIZED_LABEL : (categoryName.get(id) ?? 'Невідома категорія'),
        children: distinctStudents(list),
        portions: list.length,
        alsoChildren: id === null ? 0 : (alsoIn.get(id)?.size ?? 0),
      }
    })
    .sort((a, b) => {
      if (a.id === null) return 1
      if (b.id === null) return -1
      return a.name.localeCompare(b.name, 'uk')
    })

  return {
    days: new Set(rows.map((row) => row.menu_date)).size,
    children,
    cost,
    avgPerChild: average(cost, children),
    unpricedOrders: rows.filter((row) => row.unpriced).length,
    levels,
    levelsTotal: {
      children: levelsChildren,
      cost: levelsCost,
      avgPerChild: average(levelsCost, levelsChildren),
      gender: genderOf(inLevels),
    },
    attendance,
    attendanceTotal: {
      total: known.length > 0 ? knownTotal : null,
      ate: attendance.reduce((sum, row) => sum + row.ate, 0),
      privileged: attendance.reduce((sum, row) => sum + row.privileged, 0),
      coveragePct: knownTotal > 0 ? round1((knownAte / knownTotal) * 100) : null,
    },
    categories: categoryRows,
    categoriesTotal: {
      children: distinctStudents(privilegedRows),
      portions: privilegedRows.length,
    },
    categoriesOverlap: privilegedRows.some((row) => row.category_ids.length > 1),
  }
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

// --- Розріз за статтю ---------------------------------------------------------

export interface GenderClassRow {
  classId: string
  name: string
  level: SchoolLevel | null
  counts: GenderCounts
}

export interface GenderBreakdown {
  classes: GenderClassRow[]
  levels: Array<{ level: SchoolLevel; label: string; grades: string; counts: GenderCounts }>
  total: GenderCounts
}

/** Скільки хлопців і дівчат харчувалося — по школі, ланках і класах. */
export function buildGenderBreakdown(
  rows: Array<Pick<MealRow, 'student_id' | 'class_id' | 'gender'>>,
  classes: ClassRef[],
  { currentYear }: { currentYear: string },
): GenderBreakdown {
  const classById = new Map(classes.map((klass) => [klass.id, klass]))
  const withOrders = new Set(rows.map((row) => row.class_id))
  const visible = classes
    .filter((klass) => klass.academic_year === currentYear || withOrders.has(klass.id))
    .sort((a, b) => compareClassNames(a.name, b.name))

  const byClass = new Map<string, typeof rows>()
  for (const row of rows) {
    const list = byClass.get(row.class_id)
    if (list) list.push(row)
    else byClass.set(row.class_id, [row])
  }

  const levelOf = (classId: string) => {
    const klass = classById.get(classId)
    return klass ? schoolLevel(klass.name) : null
  }

  return {
    classes: visible.map((klass) => ({
      classId: klass.id,
      name: klass.name,
      level: schoolLevel(klass.name),
      counts: genderOf(byClass.get(klass.id) ?? []),
    })),
    levels: SCHOOL_LEVELS.map(({ level, label, grades }) => ({
      level,
      label,
      grades,
      counts: genderOf(rows.filter((row) => levelOf(row.class_id) === level)),
    })),
    total: genderOf(rows),
  }
}

// --- Замовлення за статтю на екранах замовлень ---------------------------------

const emptyCounts = (): GenderCounts => ({ male: 0, female: 0, unknown: 0, total: 0 })

/**
 * Скільки замовлень хлопців і дівчат — згруповано за ключем (класом чи днем).
 * Рахуються замовлення, не діти: за один день це те саме (одне замовлення
 * на дитину), а за період — порції.
 */
export function tallyGender<T extends { gender: Gender | null }>(
  rows: T[],
  key: (row: T) => string,
): Map<string, GenderCounts> {
  const map = new Map<string, GenderCounts>()
  for (const row of rows) {
    const k = key(row)
    const counts = map.get(k) ?? emptyCounts()
    counts[row.gender ?? 'unknown'] += 1
    counts.total += 1
    map.set(k, counts)
  }
  return map
}

export function sumGender(list: Iterable<GenderCounts>): GenderCounts {
  const sum = emptyCounts()
  for (const counts of list) {
    sum.male += counts.male
    sum.female += counts.female
    sum.unknown += counts.unknown
    sum.total += counts.total
  }
  return sum
}
