/**
 * Паралелі класів.
 *
 * Розбір навмисно повторює той, що робить `promote_academic_year` у базі:
 * `(regexp_match(name, '^\s*(\d{1,2})'))[1]::int`. Якщо вони розійдуться,
 * інтерфейс показуватиме одні межі, а переведення року виконає інші.
 */
const GRADE_PATTERN = /^\s*(\d{1,2})/

/** «7-А» → 7, «10 Б» → 10, «Підготовчий» → null */
export function parseGrade(name: string): number | null {
  const match = name.match(GRADE_PATTERN)
  if (!match) return null
  const grade = Number(match[1])
  return Number.isInteger(grade) && grade > 0 ? grade : null
}

export interface GradeRange {
  /** наймолодша паралель — саме її добирають новими класами */
  min: number
  /** найстарша — вона випускається */
  max: number
}

/**
 * Межі паралелей за наявними класами.
 *
 * Беруться з даних, а не з константи: школа може бути 5–11, 1–11 або
 * будь-якою іншою, і зашите «5» мовчки створило б дублікати класів.
 */
export function gradeRange(names: string[]): GradeRange | null {
  const grades = names
    .map(parseGrade)
    .filter((grade): grade is number => grade !== null)

  if (grades.length === 0) return null
  return { min: Math.min(...grades), max: Math.max(...grades) }
}

/**
 * Порядок класів: спершу паралель числом, потім літера. Звичайне порівняння
 * рядків ставить «10-А» перед «2-А» — так сортує й сам сервер.
 * Назви без паралелі йдуть у кінець.
 */
export function compareClassNames(a: string, b: string): number {
  const gradeA = parseGrade(a)
  const gradeB = parseGrade(b)
  if (gradeA !== gradeB) {
    if (gradeA === null) return 1
    if (gradeB === null) return -1
    return gradeA - gradeB
  }
  return a.localeCompare(b, 'uk')
}

/** Класи, назву яких не вдасться розібрати на паралель і літеру. */
export function unparsableClassNames(names: string[]): string[] {
  return names.filter((name) => parseGrade(name) === null)
}

/** Ланки школи для звітів. */
export type SchoolLevel = 'primary' | 'middle' | 'senior'

export const SCHOOL_LEVELS: Array<{ level: SchoolLevel; label: string; grades: string }> = [
  { level: 'primary', label: 'Початкова школа', grades: '1–4 класи' },
  { level: 'middle', label: 'Середня школа', grades: '5–9 класи' },
  { level: 'senior', label: 'Старша школа', grades: '10–11 класи' },
]

/** «3-А» → початкова, «7-Б» → середня, «11-А» → старша; без паралелі — null. */
export function schoolLevel(className: string): SchoolLevel | null {
  const grade = parseGrade(className)
  if (grade === null) return null
  if (grade <= 4) return 'primary'
  if (grade <= 9) return 'middle'
  return 'senior'
}
