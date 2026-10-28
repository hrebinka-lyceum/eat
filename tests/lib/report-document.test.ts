import { describe, expect, it } from 'vitest'
import { buildOrganizationReport, type MealRow } from '@/lib/mealReport'
import {
  directorName,
  formatAmount,
  formatPct,
  organizationDocument,
  periodLabel,
} from '@/lib/reportDocument'
import { pdfDefinition } from '@/lib/reportPdf'

const NBSP = ' '

describe('форматування для документа', () => {
  // Вручну, без Intl: в офіційному документі сума має бути саме такою,
  // незалежно від того, які дані ICU в браузера.
  it('сума з пробілом-розділювачем тисяч і комою', () => {
    expect(formatAmount(260643.149)).toBe(`260${NBSP}643,15`)
    expect(formatAmount(1234567)).toBe(`1${NBSP}234${NBSP}567,00`)
    expect(formatAmount(58.5)).toBe('58,50')
    expect(formatAmount(0)).toBe('0,00')
  })

  it('відсоток з однією цифрою після коми', () => {
    expect(formatPct(75.25)).toBe('75,3')
    expect(formatPct(100)).toBe('100,0')
    expect(formatPct(null)).toBe('—')
  })

  it('ім’я директора — «Ім’я ПРІЗВИЩЕ»', () => {
    expect(directorName('Олена', 'Петренко')).toBe('Олена ПЕТРЕНКО')
    expect(directorName(' ', 'Їжакевич')).toBe('ЇЖАКЕВИЧ')
    expect(directorName('', '')).toBe('')
  })
})

describe('periodLabel', () => {
  it('рівно календарний місяць — «за жовтень 2026 року»', () => {
    expect(periodLabel('2026-10-01', '2026-10-31')).toBe('за жовтень 2026 року')
    expect(periodLabel('2027-02-01', '2027-02-28')).toBe('за лютий 2027 року')
  })

  it('довільний період — з датами', () => {
    expect(periodLabel('2026-10-01', '2026-10-15')).toBe('за період з 01.10.2026 по 15.10.2026')
    expect(periodLabel('2026-09-01', '2026-10-31')).toBe('за період з 01.09.2026 по 31.10.2026')
  })
})

const row = (over: Partial<MealRow>): MealRow => ({
  menu_date: '2026-10-01',
  student_id: 's1',
  class_id: 'c1',
  privileged: false,
  cost: 58.4,
  unpriced: false,
  gender: 'female',
  category_id: null,
  ...over,
})

const report = buildOrganizationReport(
  [
    row({ student_id: 'a' }),
    row({ student_id: 'b', class_id: 'c7', gender: 'male', privileged: true, category_id: 'vpo' }),
  ],
  [
    { id: 'c1', name: '1-А', academic_year: '2026/2027', total_students: 20 },
    { id: 'c7', name: '7-А', academic_year: '2026/2027', total_students: 25 },
  ],
  [{ id: 'vpo', name: 'Діти з числа ВПО' }],
  { currentYear: '2026/2027' },
)

describe('organizationDocument', () => {
  const doc = organizationDocument(report, {
    from: '2026-10-01',
    to: '2026-10-31',
    director: { firstName: 'Олена', lastName: 'Петренко' },
    year: '2026',
  })

  it('шапка як на бланку: «ЗАТВЕРДЖУЮ», посада, підпис з ім’ям, дата', () => {
    expect(doc.approval[0]).toBe('ЗАТВЕРДЖУЮ')
    expect(doc.approval[1]).toBe('Директор')
    expect(doc.approval[2]).toMatch(/^_+ Олена ПЕТРЕНКО$/)
    expect(doc.approval[3]).toBe('«___» ______________ 2026 р.')
    expect(doc.title).toBe('ЗВІТ ПРО ОРГАНІЗАЦІЮ ХАРЧУВАННЯ УЧНІВ')
    expect(doc.period).toBe('за жовтень 2026 року')
  })

  it('без імені директора лишається лише лінія для підпису', () => {
    const blank = organizationDocument(report, { from: '2026-10-01', to: '2026-10-31', director: null, year: '2026' })
    expect(blank.approval).toEqual(['ЗАТВЕРДЖУЮ', expect.stringMatching(/^Директор _+$/), '«___» ______________ 2026 р.'])
  })

  it('розділи в порядку з технічного завдання', () => {
    expect(doc.sections.map((s) => s.heading)).toEqual([
      '1. Загальна інформація',
      '2. Харчування за групами класів',
      '3. Відвідування',
      '4. Пільгові категорії',
      '5. Харчування за статтю',
    ])
  })

  it('загальна інформація: дні, діти, вартість, середня на дитину', () => {
    expect(doc.sections[0].table.rows).toEqual([
      ['Кількість днів харчування', '1'],
      ['Кількість дітей, які харчувалися', '2'],
      ['Загальна вартість харчування, грн', '116,80'],
      ['Середня вартість на одну дитину, грн', '58,40'],
    ])
  })

  it('колонку «Стать не вказано» показує лише тоді, коли такі діти є', () => {
    expect(doc.sections[4].table.columns.map((c) => c.header)).toEqual([
      'Група класів', 'Хлопців', 'Дівчат', 'Разом',
    ])
  })

  it('кожен рядок таблиці має стільки клітинок, скільки колонок', () => {
    for (const section of doc.sections) {
      const width = section.table.columns.length
      for (const cells of [...section.table.rows, ...(section.table.total ? [section.table.total] : [])]) {
        expect(cells).toHaveLength(width)
      }
    }
  })

  it('PDF: ті самі таблиці й шапка, ширини вміщаються в аркуш', () => {
    const definition = pdfDefinition(doc) as {
      pageMargins: number[]
      content: Array<{ text?: string; columns?: unknown; table?: { widths: number[]; body: unknown[][] } }>
    }
    const text = JSON.stringify(definition.content)
    expect(text).toContain('ЗАТВЕРДЖУЮ')
    expect(text).toContain('Олена ПЕТРЕНКО')
    expect(text).toContain('за жовтень 2026 року')

    const tables = definition.content.filter((node) => node.table)
    expect(tables).toHaveLength(doc.sections.length)
    const contentWidth = 595.28 - definition.pageMargins[0] - definition.pageMargins[2]
    for (const node of tables) {
      const widths = node.table!.widths
      expect(widths.reduce((a, b) => a + b, 0)).toBeLessThan(contentWidth)
    }
    // заголовок + рядки + підсумок
    expect(tables[1].table!.body).toHaveLength(1 + 3 + 1)
  })
})
