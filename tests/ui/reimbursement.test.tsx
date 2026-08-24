import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../helpers'

const { costRows } = vi.hoisted(() => ({ costRows: vi.fn() }))
vi.mock('@/api/stats', () => ({ costRows }))
vi.mock('@/api/classes', () => ({
  listClasses: vi.fn(async () => [
    { id: 'c1', name: '7-А', academic_year: '2026/2027', teacher_id: null, total_students: 28 },
  ]),
}))
vi.mock('@/api/settings', () => ({
  getSettings: vi.fn(async () => ({
    id: true, cutoff_time: '08:00', cutoff_days_before: 0, timezone: 'Europe/Kyiv',
    current_year: '2026/2027', login_domain: 'school.local',
  })),
}))

const { default: ReimbursementReport } = await import('@/pages/admin/reports/ReimbursementReport')

describe('звіт про відшкодування', () => {
  it('ділить порції на пільгові та звичайні', async () => {
    costRows.mockResolvedValue([
      { menu_date: '2026-09-01', class_id: 'c1', privileged: true, cost: 60, missing_prices: 0 },
      { menu_date: '2026-09-01', class_id: 'c1', privileged: false, cost: 40, missing_prices: 0 },
      { menu_date: '2026-09-02', class_id: 'c1', privileged: false, cost: 40, missing_prices: 0 },
    ])

    renderWithProviders(<ReimbursementReport />, { role: 'admin' })

    const row = (await screen.findByText('7-А')).closest('tr')!
    expect(within(row).getByText('1')).toBeInTheDocument() // порцій пільгових
    expect(within(row).getByText('2')).toBeInTheDocument() // порцій звичайних
  })

  // Пастка: страва без ціни додає до суми нуль, і звіт мовчки занижує
  // відшкодування. Попередження має бути видно.
  it('попереджає про позиції без ціни', async () => {
    costRows.mockResolvedValue([
      { menu_date: '2026-09-01', class_id: 'c1', privileged: false, cost: 24, missing_prices: 2 },
    ])

    renderWithProviders(<ReimbursementReport />, { role: 'admin' })

    expect(await screen.findByText('Сума неповна')).toBeInTheDocument()
    expect(screen.getByText(/2 позиції без ціни/)).toBeInTheDocument()
  })

  it('без таких позицій попередження немає', async () => {
    costRows.mockResolvedValue([
      { menu_date: '2026-09-01', class_id: 'c1', privileged: false, cost: 24, missing_prices: 0 },
    ])

    renderWithProviders(<ReimbursementReport />, { role: 'admin' })

    await screen.findByText('7-А')
    expect(screen.queryByText('Сума неповна')).not.toBeInTheDocument()
  })
})
