import { describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../helpers'

vi.mock('@/api/admin', () => ({
  listPurgeLog: vi.fn(async () => [
    {
      id: 1,
      performed_by: 'u1',
      performed_at: '2026-10-29T09:00:00Z',
      period_from: '2026-09-01',
      period_to: '2026-10-27',
      scopes: ['student'],
      result: { student: 'Бойко Анна (7-А)', orders: 12 },
    },
  ]),
}))
vi.mock('@/api/profiles', () => ({
  listStaff: vi.fn(async () => [{ id: 'u1', full_name: 'Головко Наталія', role: 'superadmin' }]),
}))

const { default: PurgeLogPage } = await import('@/pages/superadmin/PurgeLogPage')

describe('журнал видалень', () => {
  // Повне видалення учня стирає звіти заднім числом — слід про це лишається.
  it('показує, кого видалено повністю і скільки замовлень зникло', async () => {
    renderWithProviders(<PurgeLogPage />, { role: 'superadmin' })
    expect(await screen.findByText('учень повністю')).toBeInTheDocument()
    expect(screen.getByText('Бойко Анна (7-А), замовлень 12')).toBeInTheDocument()
  })
})
