import { beforeEach, describe, expect, it, vi } from 'vitest'

const { rpc, db } = vi.hoisted(() => ({
  rpc: vi.fn(),
  db: { dates: [] as string[] },
}))

vi.mock('@/lib/supabase', () => {
  const from = () => {
    let ascending = true
    let head = false
    const builder: Record<string, unknown> = {}
    builder.select = (_columns: string, options?: { head?: boolean }) => {
      head = Boolean(options?.head)
      return builder
    }
    builder.eq = () => builder
    builder.order = (_column: string, options?: { ascending?: boolean }) => {
      ascending = options?.ascending ?? true
      return builder
    }
    builder.limit = () => builder
    builder.maybeSingle = () => {
      const sorted = [...db.dates].sort()
      const date = ascending ? sorted[0] : sorted[sorted.length - 1]
      return Promise.resolve({ data: date ? { menu_date: date } : null, error: null })
    }
    // Запит із count і head: true очікують напряму.
    // oxlint-disable-next-line no-thenable
    builder.then = (resolve: (value: unknown) => unknown) =>
      resolve({ data: null, count: head ? db.dates.length : null, error: null })
    return builder
  }
  return { SUPABASE_URL: 'http://localhost', supabase: { from, rpc } }
})

const { deleteStudent, studentOrderSummary } = await import('@/api/students')

beforeEach(() => {
  rpc.mockReset()
  rpc.mockResolvedValue({ data: { ok: true }, error: null })
})

describe('deleteStudent', () => {
  // Без примусу параметр не передається взагалі — звичайне видалення працює
  // й на сервері, де ще стара версія функції.
  it('без примусу не передає p_force', async () => {
    await deleteStudent('s1')
    expect(rpc).toHaveBeenCalledWith('delete_student', { p_student_id: 's1' })
  })

  it('повне видалення передає p_force', async () => {
    await deleteStudent('s1', { force: true })
    expect(rpc).toHaveBeenCalledWith('delete_student', { p_student_id: 's1', p_force: true })
  })

  it('відмову в правах пояснює людською мовою', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '42501', message: 'x', details: '', hint: '' } })
    await expect(deleteStudent('s1', { force: true })).rejects.toThrow(/лише суперадміністратор/)
  })
})

describe('studentOrderSummary', () => {
  it('рахує замовлення і бере першу й останню дату', async () => {
    db.dates = ['2026-10-02', '2026-09-01', '2026-10-27']
    await expect(studentOrderSummary('s1')).resolves.toEqual({
      count: 3,
      first: '2026-09-01',
      last: '2026-10-27',
    })
  })

  it('без замовлень — нуль і порожні дати', async () => {
    db.dates = []
    await expect(studentOrderSummary('s1')).resolves.toEqual({ count: 0, first: null, last: null })
  })
})
