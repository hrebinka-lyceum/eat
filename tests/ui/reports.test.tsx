import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../helpers'

const { classCoverage } = vi.hoisted(() => ({ classCoverage: vi.fn() }))
vi.mock('@/api/stats', () => ({ classCoverage }))

const { default: CoverageReport } = await import('@/pages/admin/reports/CoverageReport')

const day = (class_id: string, class_name: string, inClass: number, ordered: number, menu_date = '2026-09-01') => ({
  menu_date,
  class_id,
  class_name,
  total_students: null,
  students_registered: inClass,
  students_ordered: ordered,
  coverage_registered_pct: null,
  coverage_class_pct: null,
})

describe('звіт про охоплення', () => {
  // Список класу — усі учні, тож «учнів у класі» береться зі списку,
  // а охоплення — частка класу, що замовила.
  it('рахує охоплення від усього класу', async () => {
    classCoverage.mockResolvedValue([day('c1', '7-А', 28, 21), day('c2', '7-Б', 26, 13)])

    renderWithProviders(<CoverageReport />, { role: 'admin' })

    const row = (await screen.findByText('7-А')).closest('tr')!
    const cells = within(row).getAllByRole('cell').map((cell) => cell.textContent)
    // Клас · Учнів у класі · У середньому за день · Охоплення
    expect(cells).toEqual(['7-А', '28', '21.0', '75%'])
  })

  // Пастка: середнє денних відсотків дало б день з одним учнем вагу повного.
  it('підсумок школи — від сум, а не середнє відсотків класів', async () => {
    classCoverage.mockResolvedValue([day('c1', '7-А', 28, 21), day('c2', '7-Б', 26, 13)])

    renderWithProviders(<CoverageReport />, { role: 'admin' })

    const totalRow = (await screen.findByText('Разом по школі')).closest('tr')!
    // (21 + 13) / (28 + 26) = 63%; середнє відсотків дало б (75 + 50) / 2 = 62,5%
    expect(within(totalRow).getByText('63%')).toBeInTheDocument()
    expect(within(totalRow).getByText('54')).toBeInTheDocument()
  })

  it('другого відсотка й поля «розмір класу» більше немає', async () => {
    classCoverage.mockResolvedValue([day('c1', '7-А', 28, 21)])
    renderWithProviders(<CoverageReport />, { role: 'admin' })

    await screen.findByText('7-А')
    expect(screen.queryByText(/У реєстрі/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Усього в класі/)).not.toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Охоплення, % від класу' })).toBeInTheDocument()
  })
})
