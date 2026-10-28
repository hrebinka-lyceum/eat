import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../helpers'
import { toIsoDate } from '@/lib/format'

const { ordersByDish, dailyTotals, classCoverage, costRows } = vi.hoisted(() => ({
  ordersByDish: vi.fn(),
  dailyTotals: vi.fn(),
  classCoverage: vi.fn(),
  costRows: vi.fn(),
}))

vi.mock('@/api/stats', () => ({ ordersByDish, dailyTotals, classCoverage, costRows }))

const { default: PortionsPage } = await import('@/pages/cafeteria/PortionsPage')

const today = toIsoDate()

const component = (dish_id: string, dish_name: string, portions: number, cost: number | null) => ({
  menu_date: today, dish_id, dish_name, category: 'second' as const,
  portions, portions_privileged: 21, portions_late: 2, total_cost: cost,
})

beforeEach(() => {
  vi.clearAllMocks()
  // Блюдо з трьох компонентів: кожен іде всім 84 замовленням.
  ordersByDish.mockResolvedValue([
    component('d1', 'Гречана каша', 84, 5250),
    component('d2', 'Котлета', 84, null),
    component('d3', 'Чай', 84, null),
  ])
  dailyTotals.mockResolvedValue([
    { menu_date: today, orders_total: 84, orders_privileged: 21, orders_regular: 63, orders_late: 2, total_cost: 5250 },
  ])
  classCoverage.mockResolvedValue([])
  costRows.mockResolvedValue([])
})

describe('аркуш порцій', () => {
  // Регресія: плитка підсумовувала порції по компонентах і показувала 252
  // замість 84 — кухня приготувала б утричі більше.
  it('показує кількість блюд, а не суму порцій по компонентах', async () => {
    renderWithProviders(<PortionsPage />, { role: 'cafeteria' })

    const tile = (await screen.findByText('Порцій блюда')).closest('div') as HTMLElement
    expect(within(tile).getByText('84')).toBeInTheDocument()
    expect(screen.queryByText('252')).not.toBeInTheDocument()
  })

  it('кожен компонент показує свої порції без підсумкового рядка', async () => {
    renderWithProviders(<PortionsPage />, { role: 'cafeteria' })

    await screen.findByText('Гречана каша')
    expect(screen.getByText('Котлета')).toBeInTheDocument()
    // Підсумок по компонентах не має сенсу — його немає.
    expect(screen.queryByText('Разом')).not.toBeInTheDocument()
  })

  it('вартість показується одна на день, а не за компонент', async () => {
    renderWithProviders(<PortionsPage />, { role: 'cafeteria' })

    await screen.findByText('Гречана каша')
    const row = screen.getByText('Котлета').closest('tr') as HTMLElement
    expect(within(row).queryByText(/грн|₴/)).not.toBeInTheDocument()
    expect(screen.getByText('Вартість за день')).toBeInTheDocument()
  })
})
