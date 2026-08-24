import { describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../helpers'

const { classCoverage } = vi.hoisted(() => ({ classCoverage: vi.fn() }))
vi.mock('@/api/stats', () => ({ classCoverage }))

const { default: CoverageReport } = await import('@/pages/admin/reports/CoverageReport')

const day = (class_id: string, class_name: string, total: number | null, reg: number, ord: number) => ({
  menu_date: '2026-09-01',
  class_id,
  class_name,
  total_students: total,
  students_registered: reg,
  students_ordered: ord,
  coverage_registered_pct: null,
  coverage_class_pct: null,
})

describe('звіт про охоплення', () => {
  // Наскрізна перевірка тієї самої регресії, але вже на екрані: клас без
  // указаного розміру не має роздувати підсумок понад 100%.
  it('підсумковий рядок не показує понад 100% через клас без розміру', async () => {
    classCoverage.mockResolvedValue([
      day('c1', '7-А', 28, 21, 18),
      day('c2', '7-Б', 26, 19, 11),
      day('c3', '8-А', null, 24, 22),
    ])

    renderWithProviders(<CoverageReport />, { role: 'admin' })

    const totalRow = (await screen.findByText('Разом по школі')).closest('tr')!
    // (21 + 19) / (28 + 26) = 74,1%
    expect(within(totalRow).getByText('74,1%')).toBeInTheDocument()
    expect(totalRow.textContent).not.toMatch(/1\d\d,\d%/)
  })

  it('клас без розміру названий поіменно, а його відсоток порожній', async () => {
    classCoverage.mockResolvedValue([day('c3', '8-А', null, 24, 22)])

    renderWithProviders(<CoverageReport />, { role: 'admin' })

    const row = (await screen.findByText('8-А')).closest('tr')!
    expect(within(row).getAllByText('—').length).toBeGreaterThan(0)
    expect(
      await screen.findByText(/порахований без класів 8-А/),
    ).toBeInTheDocument()
  })

  it('колонка названа «у реєстрі», а не «харчуються» — на дашборді це інше число', async () => {
    classCoverage.mockResolvedValue([day('c1', '7-А', 28, 21, 18)])
    renderWithProviders(<CoverageReport />, { role: 'admin' })

    // Підпис має бути однаковий і в заголовку колонки, і в поясненні під
    // таблицею — інакше два різні числа житимуть під однією назвою.
    const labels = await screen.findAllByText(/У реєстрі, % від усього класу/)
    expect(labels.length).toBeGreaterThanOrEqual(2)
    expect(screen.queryByText(/^Харчуються, % від усього класу$/)).not.toBeInTheDocument()
  })
})
