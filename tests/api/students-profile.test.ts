import { describe, expect, it, vi } from 'vitest'

const { rpc, update } = vi.hoisted(() => ({ rpc: vi.fn(), update: vi.fn() }))

vi.mock('@/lib/supabase', () => {
  const builder: Record<string, unknown> = {}
  builder.update = (patch: unknown) => {
    update(patch)
    return builder
  }
  builder.eq = () => builder
  builder.select = () => builder
  builder.single = () => Promise.resolve({ data: { id: 's1' }, error: null })
  return { SUPABASE_URL: 'http://localhost', supabase: { from: () => builder, rpc } }
})

const { deleteStudent, privilegeFields, updateStudentProfile } = await import('@/api/students')

describe('пільга в записі', () => {
  // У базі стоїть check: категорія без is_privileged заборонена. Тому обидва
  // поля завжди пишуться разом.
  it('хоч одна категорія ставить і is_privileged', () => {
    expect(privilegeFields({ categoryIds: ['vpo', 'big'], uncategorized: false })).toEqual({
      is_privileged: true,
      privilege_category_ids: ['vpo', 'big'],
    })
  })

  it('без категорій — без пільги', () => {
    expect(privilegeFields({ categoryIds: [], uncategorized: false })).toEqual({
      is_privileged: false,
      privilege_category_ids: [],
    })
  })

  it('стара пільга без категорії лишається пільгою', () => {
    expect(privilegeFields({ categoryIds: [], uncategorized: true })).toEqual({
      is_privileged: true,
      privilege_category_ids: [],
    })
  })

  it('однакову категорію двічі не пише', () => {
    expect(privilegeFields({ categoryIds: ['vpo', 'vpo'], uncategorized: false }).privilege_category_ids).toEqual(['vpo'])
  })

  it('профіль пишеться одним update з обрізаними пробілами', async () => {
    await updateStudentProfile('s1', {
      lastName: '  Бойко ',
      firstName: 'Анна ',
      gender: 'female',
      privilege: { categoryIds: ['vpo'], uncategorized: false },
    })
    expect(update).toHaveBeenCalledWith({
      last_name: 'Бойко',
      first_name: 'Анна',
      gender: 'female',
      is_privileged: true,
      privilege_category_ids: ['vpo'],
    })
  })
})

describe('deleteStudent', () => {
  // Учня із замовленнями сервер не видаляє: orders.student_id стоїть ON DELETE
  // CASCADE, і разом з ним зникла б уся історія. Людині треба сказати, що робити.
  it('відмову через замовлення пояснює і підказує вихід', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: '23503', message: 'x', details: '', hint: '' } })
    await expect(deleteStudent('s1')).rejects.toThrow(/уже має замовлення.*Більше не харчується/)
  })

  it('передає примітку, якщо акаунт не вдалося прибрати', async () => {
    rpc.mockResolvedValue({ data: { account_note: 'Приберіть акаунт вручну' }, error: null })
    await expect(deleteStudent('s1')).resolves.toEqual({ accountNote: 'Приберіть акаунт вручну' })
    expect(rpc).toHaveBeenCalledWith('delete_student', { p_student_id: 's1' })
  })
})
