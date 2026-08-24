import { describe, expect, it } from 'vitest'
import {
  hoursUntil,
  isWeekendIso,
  monthBounds,
  monthValueBounds,
  nextMonthBounds,
  nextWorkday,
  prevWorkday,
  shiftIso,
  toMonthValue,
} from '@/lib/dates'

describe('робочі дні', () => {
  // 2026-09-04 — п'ятниця, 05 і 06 — вихідні, 07 — понеділок
  it('наступний робочий день перестрибує вихідні', () => {
    expect(nextWorkday('2026-09-04')).toBe('2026-09-07')
  })

  it('попередній робочий день теж', () => {
    expect(prevWorkday('2026-09-07')).toBe('2026-09-04')
  })

  it('впізнає вихідний', () => {
    expect(isWeekendIso('2026-09-05')).toBe(true)
    expect(isWeekendIso('2026-09-04')).toBe(false)
  })
})

describe('періоди', () => {
  // Регресія: арифметика йшла в локальному часі, а результат форматувався
  // в київському, тож кінець вересня перетворювався на 1 жовтня — і звіт
  // за місяць захоплював зайвий день. Тести бігають в UTC саме тому.
  it('межі місяця', () => {
    expect(monthBounds('2026-09-15')).toEqual(['2026-09-01', '2026-09-30'])
    expect(monthBounds('2026-12-31')).toEqual(['2026-12-01', '2026-12-31'])
    expect(monthValueBounds('2026-02')).toEqual(['2026-02-01', '2026-02-28'])
  })

  it('наступний місяць', () => {
    expect(nextMonthBounds('2026-09-15')).toEqual(['2026-10-01', '2026-10-31'])
  })

  it('зсув дати', () => {
    expect(shiftIso('2026-09-01', 13)).toBe('2026-09-14')
    expect(shiftIso('2026-09-01', -1)).toBe('2026-08-31')
  })

  it('значення для <input type="month">', () => {
    expect(toMonthValue('2026-09-15')).toBe('2026-09')
  })
})

describe('дедлайн', () => {
  // Використовується ЛИШЕ для попередження при публікації меню;
  // рішення про прийом замовлень ухвалює сервер.
  it('майбутнє дає додатне значення, минуле — від’ємне', () => {
    expect(hoursUntil(new Date(Date.now() + 3_600_000).toISOString())).toBeCloseTo(1, 1)
    expect(hoursUntil(new Date(Date.now() - 3_600_000).toISOString())).toBeCloseTo(-1, 1)
  })
})
