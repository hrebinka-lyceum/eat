import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `promote_academic_year` має типові `p_min_grade = 5`, `p_max_grade = 11`.
 * Для школи з 1–4 класами вони хибні: четверті стають п'ятими, після чого
 * цикл вхідних класів вставляє ще один «5-А» і вся транзакція падає на
 * `unique (name, academic_year)`. Тому межі мусять доходити до бази.
 */
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }))

vi.mock('@/lib/supabase', () => ({
  SUPABASE_URL: 'http://localhost',
  supabase: { rpc },
}))

const { promoteAcademicYear } = await import('@/api/admin')

beforeEach(() => {
  rpc.mockReset()
  rpc.mockResolvedValue({ data: { new_year: '2027/2028' }, error: null })
})

describe('promoteAcademicYear', () => {
  it('передає межі паралелей у RPC', async () => {
    await promoteAcademicYear('2027/2028', { minGrade: 1, maxGrade: 11 })

    expect(rpc).toHaveBeenCalledWith('promote_academic_year', {
      p_new_year: '2027/2028',
      p_min_grade: 1,
      p_max_grade: 11,
    })
  })

  it('передає й дату початку, коли вона вказана', async () => {
    await promoteAcademicYear('2027/2028', {
      startDate: '2027-09-02',
      minGrade: 5,
      maxGrade: 11,
    })

    expect(rpc).toHaveBeenCalledWith('promote_academic_year', {
      p_new_year: '2027/2028',
      p_start_date: '2027-09-02',
      p_min_grade: 5,
      p_max_grade: 11,
    })
  })

  // Без меж краще не вигадувати своїх: хай діють типові значення функції.
  it('без меж надсилає лише рік', async () => {
    await promoteAcademicYear('2027/2028')

    expect(rpc).toHaveBeenCalledWith('promote_academic_year', {
      p_new_year: '2027/2028',
    })
  })

  it('помилку бази перетворює на зрозуміле повідомлення', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: 'boom', code: 'P0001' } })

    await expect(promoteAcademicYear('2027/2028', { minGrade: 1, maxGrade: 11 })).rejects.toThrow()
  })
})
