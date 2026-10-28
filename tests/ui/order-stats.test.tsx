import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../helpers'
import { shiftIso } from '@/lib/dates'
import { toIsoDate } from '@/lib/format'

const { listMenuDays, dailyTotals, classCoverage, orderGenders } = vi.hoisted(() => ({
  listMenuDays: vi.fn(),
  dailyTotals: vi.fn(),
  classCoverage: vi.fn(),
  orderGenders: vi.fn(),
}))

vi.mock('@/api/menu', () => ({ listMenuDays }))
vi.mock('@/api/stats', () => ({ dailyTotals, classCoverage, orderGenders }))

const { default: OrderStatsPage } = await import('@/pages/cafeteria/OrderStatsPage')

const today = toIsoDate()
const yesterday = shiftIso(today, -1)
const tomorrow = shiftIso(today, 1)

const day = (menu_date: string) => ({
  menu_date, status: 'published' as const,
  cutoff_at: `${menu_date}T05:00:00Z`, created_at: menu_date,
})

const totals = (menu_date: string, total: number, privileged: number) => ({
  menu_date,
  orders_total: total,
  orders_privileged: privileged,
  orders_regular: total - privileged,
  orders_late: 0,
  total_cost: total * 25,
})

const coverage = (menu_date: string, class_id: string, class_name: string, ordered: number) => ({
  menu_date, class_id, class_name, total_students: 28,
  students_registered: 20, students_ordered: ordered,
  coverage_registered_pct: null, coverage_class_pct: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  listMenuDays.mockResolvedValue([day(yesterday), day(today), day(tomorrow)])
  dailyTotals.mockResolvedValue([totals(yesterday, 40, 10), totals(today, 52, 12)])
  classCoverage.mockResolvedValue([
    coverage(yesterday, 'c1', '7-А', 18),
    coverage(yesterday, 'c2', '7-Б', 22),
    coverage(today, 'c1', '7-А', 20),
    coverage(today, 'c2', '7-Б', 32),
    coverage(tomorrow, 'c1', '7-А', 5),
  ])
  orderGenders.mockResolvedValue([])
})

const genders = (menu_date: string, class_id: string, male: number, female: number) => [
  ...Array.from({ length: male }, () => ({ menu_date, class_id, gender: 'male' as const })),
  ...Array.from({ length: female }, () => ({ menu_date, class_id, gender: 'female' as const })),
]

const renderPage = () => renderWithProviders(<OrderStatsPage />, { role: 'cafeteria' })

describe('замовлення по днях', () => {
  it('показує підсумки за період', async () => {
    renderPage()

    // 40 + 52; завтрашній день поки без замовлень. Те саме число є і в
    // підсумковому рядку таблиці, тому дивимось саме на плитку.
    const tile = (await screen.findByText('Замовлень за період')).closest('div') as HTMLElement
    expect(within(tile).getByText('92')).toBeInTheDocument()
    expect(screen.getByText('Найбільший день')).toBeInTheDocument()
  })

  // Кістяк — дні меню, а не дні із замовленнями: інакше завтрашній день,
  // на який ще ніхто не замовив, просто зник би з планування.
  it('показує майбутній день навіть без замовлень і позначає його', async () => {
    renderPage()
    await screen.findByText('Замовлень за період')

    expect(screen.getByText('попереду')).toBeInTheDocument()
  })

  it('рахує класи по днях із підсумком за період', async () => {
    renderPage()
    await screen.findByText('Класи по днях')

    const row = (await screen.findByText('7-Б')).closest('tr') as HTMLElement
    expect(within(row).getByText('22')).toBeInTheDocument()
    expect(within(row).getByText('32')).toBeInTheDocument()
    // 22 + 32 за період
    expect(within(row).getByText('54')).toBeInTheDocument()
  })

  it('їдальня бачить вартість — це її роль', async () => {
    const { container } = renderPage()
    await screen.findByText('Замовлень за період')

    expect(container.textContent).toMatch(/Вартість за період/)
  })

  it('без днів меню пояснює, чого бракує', async () => {
    listMenuDays.mockResolvedValue([])
    dailyTotals.mockResolvedValue([])
    classCoverage.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText(/немає жодного дня меню/)).toBeInTheDocument()
  })

  it('показує хлопців і дівчат по днях і по класах', async () => {
    orderGenders.mockResolvedValue([
      ...genders(yesterday, 'c1', 10, 8),
      ...genders(today, 'c1', 12, 8),
      ...genders(today, 'c2', 15, 17),
    ])
    renderPage()

    // День: сьогодні 52 замовлення = 27 хлопців + 25 дівчат.
    await screen.findByText('Класи по днях')
    const daysTable = screen.getAllByRole('table')[0]
    const dayRow = within(daysTable).getByRole('cell', { name: '52' }).closest('tr') as HTMLElement
    const dayCells = within(dayRow).getAllByRole('cell').map((cell) => cell.textContent)
    expect(dayCells.slice(1, 4)).toEqual(['52', '27', '25'])

    // Клас 7-А за період: 10 + 12 хлопців і 8 + 8 дівчат.
    const classRow = screen.getAllByRole('cell', { name: '7-А' }).at(-1)!.closest('tr') as HTMLElement
    const classCells = within(classRow).getAllByRole('cell').map((cell) => cell.textContent)
    expect(classCells.slice(-2)).toEqual(['22', '16'])
  })
})
