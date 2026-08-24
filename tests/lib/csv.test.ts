import { describe, expect, it } from 'vitest'
import { buildCsv, csvFilename } from '@/lib/csv'

interface Row {
  name: string
  count: number
  active: boolean
  price: number | null
}

const columns = [
  { header: 'Назва', value: (r: Row) => r.name },
  { header: 'Кількість', value: (r: Row) => r.count },
  { header: 'Активна', value: (r: Row) => r.active },
  { header: 'Ціна', value: (r: Row) => r.price },
]

describe('buildCsv', () => {
  it('починається з BOM і має заголовок', () => {
    const csv = buildCsv<Row>([], columns)
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv).toContain('Назва;Кількість;Активна;Ціна')
  })

  it('роздільник — крапка з комою, рядки — CRLF', () => {
    const csv = buildCsv<Row>([{ name: 'Борщ', count: 84, active: true, price: 24.5 }], columns)
    expect(csv).toContain('Борщ;84;так;24.5')
    expect(csv).toContain('\r\n')
  })

  it('булеве стає «так/ні», null — порожньою коміркою', () => {
    const csv = buildCsv<Row>([{ name: 'Компот', count: 0, active: false, price: null }], columns)
    expect(csv).toContain('Компот;0;ні;')
  })

  it('екранує роздільник, лапки й переноси', () => {
    const csv = buildCsv<Row>(
      [{ name: 'Суп; з "грінками"\nдомашній', count: 1, active: true, price: 1 }],
      columns,
    )
    expect(csv).toContain('"Суп; з ""грінками""\nдомашній"')
  })
})

describe('csvFilename', () => {
  it('додає дату й розширення', () => {
    expect(csvFilename('страви', '2026-09-01')).toBe('страви-2026-09-01.csv')
  })
})
