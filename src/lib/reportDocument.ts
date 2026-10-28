// ---------------------------------------------------------------------------
//  Зміст документа «Звіт про організацію харчування учнів».
//
//  Один нейтральний опис — шапка, заголовок, розділи з таблицями — з якого
//  окремо малюються DOCX і PDF. Так обидва файли гарантовано однакові, а
//  перевіряти тестами можна цю модель, а не байти документів.
//
//  Числа форматуються вручну, без Intl: Node і браузер мають різні дані ICU,
//  а в офіційному документі «1 234,50» має бути саме таким.
// ---------------------------------------------------------------------------
import { parseISO } from 'date-fns'
import type { OrganizationReport } from './mealReport'

export type Align = 'left' | 'center' | 'right'

export interface DocColumn {
  header: string
  align: Align
  /** відносна ширина колонки */
  width: number
}

export interface DocTable {
  columns: DocColumn[]
  rows: string[][]
  /** підсумковий рядок, друкується жирним */
  total?: string[]
}

export interface DocSection {
  heading: string
  table: DocTable
  note?: string
}

export interface ReportDocumentModel {
  /**
   * Гриф затвердження, рядок за рядком. З іменем директора підпис і ім'я
   * стоять окремим рядком під посадою: в одному рядку довге ім'я
   * переносилося б і відривало прізвище від імені.
   */
  approval: string[]
  title: string
  period: string
  sections: DocSection[]
}

const MONTHS = [
  'січень', 'лютий', 'березень', 'квітень', 'травень', 'червень',
  'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень',
]

const NBSP = ' '

/** 260643.149 → «260 643,15» */
export function formatAmount(value: number): string {
  const fixed = (Math.round(value * 100) / 100).toFixed(2)
  const [whole, fraction] = fixed.split('.')
  const sign = whole.startsWith('-') ? '-' : ''
  const digits = sign ? whole.slice(1) : whole
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP)
  return `${sign}${grouped},${fraction}`
}

/** 75.2 → «75,2»; null → «—» */
export function formatPct(value: number | null): string {
  if (value === null) return '—'
  return (Math.round(value * 10) / 10).toFixed(1).replace('.', ',')
}

export function formatCount(value: number | null): string {
  return value === null ? '—' : String(value)
}

const ddmmyyyy = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`

/**
 * «за жовтень 2026 року», якщо період — рівно календарний місяць;
 * інакше «за період з 01.10.2026 по 15.10.2026».
 */
export function periodLabel(from: string, to: string): string {
  const start = parseISO(from)
  const end = parseISO(to)
  const lastDay = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate()
  const wholeMonth =
    start.getDate() === 1 &&
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    end.getDate() === lastDay
  if (wholeMonth) return `за ${MONTHS[start.getMonth()]} ${start.getFullYear()} року`
  return `за період з ${ddmmyyyy(from)} по ${ddmmyyyy(to)}`
}

/** «Олена ПЕТРЕНКО» — так підписують офіційні документи. */
export function directorName(firstName: string, lastName: string): string {
  return [firstName.trim(), lastName.trim().toLocaleUpperCase('uk')].filter(Boolean).join(' ')
}

const SIGN_LINE = '____________'
const SIGN_LINE_ALONE = '______________________'

export function organizationDocument(
  report: OrganizationReport,
  {
    from,
    to,
    director,
    year,
  }: {
    from: string
    to: string
    director: { firstName: string; lastName: string } | null
    /** рік у рядку дати затвердження */
    year: string
  },
): ReportDocumentModel {
  const name = director ? directorName(director.firstName, director.lastName) : ''

  const sections: DocSection[] = [
    {
      heading: '1. Загальна інформація',
      table: {
        columns: [
          { header: 'Показник', align: 'left', width: 3 },
          { header: 'Значення', align: 'right', width: 1 },
        ],
        rows: [
          ['Кількість днів харчування', formatCount(report.days)],
          ['Кількість дітей, які харчувалися', formatCount(report.children)],
          ['Загальна вартість харчування, грн', formatAmount(report.cost)],
          [
            'Середня вартість на одну дитину, грн',
            report.avgPerChild === null ? '—' : formatAmount(report.avgPerChild),
          ],
        ],
      },
    },
    {
      heading: '2. Харчування за групами класів',
      table: {
        columns: [
          { header: 'Група класів', align: 'left', width: 2.4 },
          { header: 'Кількість дітей', align: 'right', width: 1.2 },
          { header: 'Загальна вартість, грн', align: 'right', width: 1.5 },
          { header: 'Середня вартість на дитину, грн', align: 'right', width: 1.5 },
        ],
        rows: report.levels.map((level) => [
          `${level.label} (${level.grades})`,
          formatCount(level.children),
          formatAmount(level.cost),
          level.avgPerChild === null ? '—' : formatAmount(level.avgPerChild),
        ]),
        total: [
          'Разом',
          formatCount(report.levelsTotal.children),
          formatAmount(report.levelsTotal.cost),
          report.levelsTotal.avgPerChild === null ? '—' : formatAmount(report.levelsTotal.avgPerChild),
        ],
      },
    },
    {
      heading: '3. Відвідування',
      table: {
        columns: [
          { header: 'Клас', align: 'left', width: 1 },
          { header: 'Учнів у класі', align: 'right', width: 1.2 },
          { header: 'Харчувалися', align: 'right', width: 1.2 },
          { header: 'З них пільговиків', align: 'right', width: 1.2 },
          { header: 'Охоплення, %', align: 'right', width: 1.2 },
        ],
        rows: report.attendance.map((row) => [
          row.name,
          formatCount(row.total),
          formatCount(row.ate),
          formatCount(row.privileged),
          formatPct(row.coveragePct),
        ]),
        total: [
          'Разом',
          formatCount(report.attendanceTotal.total),
          formatCount(report.attendanceTotal.ate),
          formatCount(report.attendanceTotal.privileged),
          formatPct(report.attendanceTotal.coveragePct),
        ],
      },
      note: report.attendance.some((row) => row.total === null)
        ? 'Для класів без вказаної кількості учнів охоплення не рахується; ' +
          'підсумковий відсоток — лише по класах, де кількість відома.'
        : undefined,
    },
    {
      heading: '4. Пільгові категорії',
      table: {
        columns: [
          { header: 'Категорія', align: 'left', width: 3 },
          { header: 'Кількість дітей', align: 'right', width: 1.2 },
          { header: 'Днів харчування', align: 'right', width: 1.2 },
        ],
        rows: report.categories.map((row) => [
          row.name,
          row.alsoChildren > 0 ? `${row.children} (+${row.alsoChildren})` : formatCount(row.children),
          formatCount(row.portions),
        ]),
        total: [
          'Разом',
          formatCount(report.categoriesTotal.children),
          formatCount(report.categoriesTotal.portions),
        ],
      },
      note:
        report.categories.length === 0
          ? 'За період пільгового харчування не було.'
          : report.categoriesOverlap
            ? 'Дитина з кількома пільговими категоріями врахована лише за першою з них. ' +
              'У дужках — діти, які мають і цю категорію, але враховані в іншому рядку; ' +
              'до «Разом» вони не додаються.'
            : undefined,
    },
    genderSection(report),
  ]

  return {
    approval: [
      'ЗАТВЕРДЖУЮ',
      ...(name ? ['Директор', `${SIGN_LINE} ${name}`] : [`Директор ${SIGN_LINE_ALONE}`]),
      `«___» ______________ ${year} р.`,
    ],
    title: 'ЗВІТ ПРО ОРГАНІЗАЦІЮ ХАРЧУВАННЯ УЧНІВ',
    period: periodLabel(from, to),
    sections,
  }
}

function genderSection(report: OrganizationReport): DocSection {
  // Колонку «Не вказано» показуємо лише тоді, коли такі діти є: у заповненому
  // реєстрі вона була б порожнім шумом.
  const withUnknown = report.levelsTotal.gender.unknown > 0
  const columns: DocColumn[] = [
    { header: 'Група класів', align: 'left', width: 2.4 },
    { header: 'Хлопців', align: 'right', width: 1 },
    { header: 'Дівчат', align: 'right', width: 1 },
    ...(withUnknown ? [{ header: 'Стать не вказано', align: 'right' as const, width: 1.2 }] : []),
    { header: 'Разом', align: 'right', width: 1 },
  ]
  const cells = (g: { male: number; female: number; unknown: number; total: number }) => [
    String(g.male),
    String(g.female),
    ...(withUnknown ? [String(g.unknown)] : []),
    String(g.total),
  ]
  return {
    heading: '5. Харчування за статтю',
    table: {
      columns,
      rows: report.levels.map((level) => [`${level.label} (${level.grades})`, ...cells(level.gender)]),
      total: ['Разом', ...cells(report.levelsTotal.gender)],
    },
  }
}
