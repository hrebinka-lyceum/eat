import { beforeEach, describe, expect, it, vi } from 'vitest'

const { db, calls } = vi.hoisted(() => ({
  db: { found: [] as Array<{ id: string; name: string; is_active: boolean }> },
  calls: { ilike: [] as string[], insert: [] as unknown[], update: [] as unknown[] },
}))

vi.mock('@/lib/supabase', () => {
  const from = () => {
    const builder: Record<string, unknown> = {}
    let mode: 'select' | 'insert' | 'update' = 'select'
    let payload: Record<string, unknown> = {}
    builder.select = () => builder
    builder.ilike = (_column: string, value: string) => {
      calls.ilike.push(value)
      return builder
    }
    builder.limit = () => builder
    builder.eq = () => builder
    builder.insert = (row: Record<string, unknown>) => {
      mode = 'insert'
      payload = row
      calls.insert.push(row)
      return builder
    }
    builder.update = (patch: Record<string, unknown>) => {
      mode = 'update'
      payload = patch
      calls.update.push(patch)
      return builder
    }
    builder.single = () =>
      Promise.resolve({
        data: mode === 'insert' ? { id: 'new', is_active: true, ...payload } : { ...db.found[0], ...payload },
        error: null,
      })
    // Пошук очікують напряму, без single().
    // oxlint-disable-next-line no-thenable
    builder.then = (resolve: (value: unknown) => unknown) => resolve({ data: db.found, error: null })
    return builder
  }
  return { SUPABASE_URL: 'http://localhost', supabase: { from } }
})

const { findOrCreateComponent, normalizeComponentName } = await import('@/api/dishes')

beforeEach(() => {
  db.found = []
  calls.ilike = []
  calls.insert = []
  calls.update = []
})

describe('normalizeComponentName', () => {
  it('прибирає зайві пробіли й робить першу літеру великою', () => {
    expect(normalizeComponentName('  гречана   каша ')).toBe('Гречана каша')
    expect(normalizeComponentName('їжак-печиво')).toBe('Їжак-печиво')
    expect(normalizeComponentName('   ')).toBe('')
  })
})

describe('findOrCreateComponent', () => {
  it('нового компонента немає — створює з порожньою ціною', async () => {
    const dish = await findOrCreateComponent('  гречка ')
    expect(calls.ilike).toEqual(['Гречка'])
    expect(calls.insert).toEqual([{ name: 'Гречка', category: 'second', price: null }])
    expect(dish.id).toBe('new')
  })

  // Назва в базі не унікальна: без пошуку «гречка» з редактора стала б
  // другою «Гречкою» в довіднику.
  it('такий уже є — бере наявний і нічого не створює', async () => {
    db.found = [{ id: 'd1', name: 'Гречка', is_active: true }]
    const dish = await findOrCreateComponent('гречка')
    expect(dish.id).toBe('d1')
    expect(calls.insert).toEqual([])
    expect(calls.update).toEqual([])
  })

  it('такий є, але вимкнений — вмикає, а не дублює', async () => {
    db.found = [{ id: 'd1', name: 'Гречка', is_active: false }]
    const dish = await findOrCreateComponent('Гречка')
    expect(calls.update).toEqual([{ is_active: true }])
    expect(calls.insert).toEqual([])
    expect(dish).toMatchObject({ id: 'd1', is_active: true })
  })

  // % і _ в ilike — шаблони; без екранування «100% сік» знайшов би «1000 соків».
  it('екранує символи шаблону в назві', async () => {
    await findOrCreateComponent('Сік 100%')
    expect(calls.ilike).toEqual(['Сік 100\\%'])
  })

  it('порожню назву не приймає', async () => {
    await expect(findOrCreateComponent('   ')).rejects.toThrow('Вкажіть назву')
  })
})
