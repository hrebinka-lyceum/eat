import { describe, expect, it } from 'vitest'
import { humanError, humanErrorWith, isForeignKeyViolation } from '@/lib/errors'
import { canSeeCost } from '@/auth/permissions'
import { HOME_BY_ROLE, navFor } from '@/nav'
import { LOGIN_PATTERN, normalizeLogin } from '@/api/auth'
import type { UserRole } from '@/types/database'

describe('людські помилки', () => {
  it('український текст із наших функцій проходить як є', () => {
    expect(humanError({ message: 'Замовлення на 2026-09-01 вже зроблено' })).toContain(
      'вже зроблено',
    )
  })

  it('коди Postgres перекладаються', () => {
    expect(humanError({ code: '42501', message: 'permission denied' })).toContain('прав')
    expect(humanError({ code: '23505', message: 'duplicate key' })).toContain('існує')
  })

  it('сирий текст Postgres не показується', () => {
    const text = humanError({ message: 'null value in column "x" violates not-null' })
    expect(text).not.toContain('null value')
  })

  it('локальне уточнення перебиває загальний текст коду', () => {
    const text = humanErrorWith({ code: '23503', message: 'fk' }, {
      '23503': 'Цю страву вже замовили на цей день',
    })
    expect(text).toBe('Цю страву вже замовили на цей день')
    expect(isForeignKeyViolation({ code: '23503' })).toBe(true)
  })

  it('мережева помилка пояснюється людською мовою', () => {
    expect(humanError({ message: 'Failed to fetch' })).toContain('зв’язку')
  })
})

describe('права на вартість', () => {
  it('їдальня й адміністрація бачать, учень і керівник — ні', () => {
    expect(canSeeCost('cafeteria')).toBe(true)
    expect(canSeeCost('admin')).toBe(true)
    expect(canSeeCost('superadmin')).toBe(true)
    expect(canSeeCost('teacher')).toBe(false)
    expect(canSeeCost('student')).toBe(false)
    expect(canSeeCost(null)).toBe(false)
  })
})

describe('навігація', () => {
  const roles: UserRole[] = ['student', 'teacher', 'cafeteria', 'admin', 'superadmin']

  it('кожна роль має домівку', () => {
    for (const role of roles) expect(HOME_BY_ROLE[role]).toMatch(/^\//)
  })

  it('меню не показує чужих пунктів', () => {
    for (const role of roles) {
      for (const item of navFor(role)) expect(item.roles).toContain(role)
    }
  })

  it('керівник не бачить розділів адміністрації', () => {
    const paths = navFor('teacher').map((item) => item.to)
    expect(paths).not.toContain('/users')
    expect(paths).not.toContain('/purge')
    expect(paths).not.toContain('/dishes')
  })

  it('їдальня не бачить дашборда школи й звітів', () => {
    const paths = navFor('cafeteria').map((item) => item.to)
    expect(paths).not.toContain('/dashboard')
    expect(paths).not.toContain('/reports')
  })
})

describe('логін', () => {
  it('нормалізується до нижнього регістру без пробілів', () => {
    expect(normalizeLogin('  Petrenko.O  ')).toBe('petrenko.o')
  })

  it('крапка дозволена — саме такі логіни видає система', () => {
    expect(LOGIN_PATTERN.test('petrenko.o')).toBe(true)
    expect(LOGIN_PATTERN.test('uchen1')).toBe(true)
    expect(LOGIN_PATTERN.test('Петренко')).toBe(false)
    expect(LOGIN_PATTERN.test('petrenko o')).toBe(false)
  })
})
