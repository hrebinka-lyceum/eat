import { describe, expect, it } from 'vitest'
import {
  formatCutoff,
  formatDate,
  formatDateWithWeekday,
  formatMoney,
  formatPercent,
  fullName,
  moneyToInput,
  parseMoneyInput,
  plural,
  toIsoDate,
} from '@/lib/format'

describe('гроші', () => {
  it('null означає «сервер не віддав вартість», а не нуль', () => {
    expect(formatMoney(null)).toBe('—')
    expect(formatMoney(undefined)).toBe('—')
    expect(formatMoney(0)).not.toBe('—')
  })

  it('форматує суму в гривнях', () => {
    // Позначку валюти не перевіряємо жорстко: Node дає «₴», браузер — «грн».
    // Це різниця даних ICU, а не поведінки коду.
    expect(formatMoney(24.5)).toMatch(/24,50/)
    expect(formatMoney(24.5)).toMatch(/грн|₴/)
  })
})

describe('дати', () => {
  it('форматує звичайну дату', () => {
    expect(formatDate('2026-09-01')).toBe('1 вересня 2026')
    expect(formatDateWithWeekday('2026-09-01')).toContain('1 вересня')
  })

  // Регресія: порожній рядок у пропсі закритого діалогу валив увесь екран
  // редактора меню з RangeError: Invalid time value.
  it.each([null, undefined, '', 'не дата'])('не падає на значенні %s', (value) => {
    expect(formatDate(value as string)).toBe('—')
    expect(formatDateWithWeekday(value as string)).toBe('—')
    expect(formatCutoff(value as string)).toBe('—')
  })

  it('toIsoDate дає формат бази', () => {
    expect(toIsoDate(new Date('2026-09-01T10:00:00Z'))).toBe('2026-09-01')
  })
})

describe('ввід ціни', () => {
  it('приймає і кому, і крапку', () => {
    expect(parseMoneyInput('24,50')).toEqual({ value: 24.5, error: null })
    expect(parseMoneyInput('24.50')).toEqual({ value: 24.5, error: null })
  })

  it('порожнє поле означає «ціни немає», а не нуль', () => {
    expect(parseMoneyInput('  ')).toEqual({ value: null, error: null })
    expect(moneyToInput(null)).toBe('')
  })

  it('відхиляє від’ємне й нечислове', () => {
    expect(parseMoneyInput('-1').error).toBeTruthy()
    expect(parseMoneyInput('абв').error).toBeTruthy()
  })

  it('округлює до копійок', () => {
    expect(parseMoneyInput('24,555').value).toBe(24.56)
  })
})

describe('відсотки й дрібниці', () => {
  it('порожній відсоток — риска', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(85.7)).toBe('85,7%')
  })

  it('українська множина', () => {
    expect(plural(1, 'позиція', 'позиції', 'позицій')).toBe('позиція')
    expect(plural(2, 'позиція', 'позиції', 'позицій')).toBe('позиції')
    expect(plural(5, 'позиція', 'позиції', 'позицій')).toBe('позицій')
    expect(plural(11, 'позиція', 'позиції', 'позицій')).toBe('позицій')
    expect(plural(22, 'позиція', 'позиції', 'позицій')).toBe('позиції')
  })

  it('ПІБ', () => {
    expect(fullName('Петренко', 'Олена')).toBe('Петренко Олена')
  })
})
