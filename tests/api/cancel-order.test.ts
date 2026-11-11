import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Скасування йде через cancel_order: права (керівник — до дедлайну й лише свій
 * клас) перевіряє сервер і пояснює відмову. Пряме видалення рядка відмовило б
 * мовчки — 0 рядків без помилки, і сайт показав би «скасовано».
 */
const rpc = vi.fn()
const from = vi.fn()
vi.mock('@/lib/supabase', () => ({
  SUPABASE_URL: 'http://localhost',
  supabase: { rpc: (...args: unknown[]) => rpc(...args), from: (...args: unknown[]) => from(...args) },
}))

const { cancelOrder } = await import('@/api/orders')

beforeEach(() => {
  rpc.mockReset()
  from.mockReset()
})

describe('скасування замовлення', () => {
  it('викликає cancel_order, а не видаляє рядок напряму', async () => {
    rpc.mockResolvedValue({ data: null, error: null })
    await cancelOrder('o1')
    expect(rpc).toHaveBeenCalledWith('cancel_order', { p_order_id: 'o1' })
    expect(from).not.toHaveBeenCalled()
  })

  it('відмову сервера показує його словами', async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: 'P0001', message: 'Час скасування замовлень на 12.11.2026 минув — зверніться до адміністратора' },
    })
    await expect(cancelOrder('o1')).rejects.toThrow('Час скасування замовлень на 12.11.2026 минув')
  })

  it('без міграції каже, що бракує налаштування на сервері', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
    await expect(cancelOrder('o1')).rejects.toThrow(/потрібна міграція/)
  })
})
