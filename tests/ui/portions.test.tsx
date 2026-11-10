import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../helpers'
import { toIsoDate } from '@/lib/format'

const {
  ordersByDish, dailyTotals, classCoverage, costRows, orderGenders, ordersByMenu,
  listSpecialMenus, listMenuItems,
} = vi.hoisted(() => ({
  ordersByDish: vi.fn(),
  dailyTotals: vi.fn(),
  classCoverage: vi.fn(),
  costRows: vi.fn(),
  orderGenders: vi.fn(),
  ordersByMenu: vi.fn(),
  listSpecialMenus: vi.fn(),
  listMenuItems: vi.fn(),
}))

vi.mock('@/api/stats', () => ({ ordersByDish, dailyTotals, classCoverage, costRows, orderGenders, ordersByMenu }))
vi.mock('@/api/specialMenus', () => ({ listSpecialMenus }))
vi.mock('@/api/menu', () => ({ listMenuItems }))

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
  orderGenders.mockResolvedValue([])
  listSpecialMenus.mockResolvedValue([])
  listMenuItems.mockResolvedValue([])
  ordersByMenu.mockResolvedValue({ main: 84, special: {} })
})

const coverage = (class_id: string, class_name: string, ordered: number) => ({
  menu_date: today, class_id, class_name, total_students: 28,
  students_registered: 25, students_ordered: ordered,
  coverage_registered_pct: null, coverage_class_pct: null,
})
const ordersOf = (class_id: string, male: number, female: number, unknown = 0) => [
  ...Array.from({ length: male }, () => ({ menu_date: today, class_id, gender: 'male' as const })),
  ...Array.from({ length: female }, () => ({ menu_date: today, class_id, gender: 'female' as const })),
  ...Array.from({ length: unknown }, () => ({ menu_date: today, class_id, gender: null })),
]

describe('аркуш порцій: хлопці й дівчата', () => {
  it('показує хлопців і дівчат за день і по кожному класу', async () => {
    classCoverage.mockResolvedValue([coverage('c1', '1-А', 5), coverage('c7', '7-А', 4)])
    orderGenders.mockResolvedValue([...ordersOf('c1', 2, 3), ...ordersOf('c7', 4, 0)])
    renderWithProviders(<PortionsPage />, { role: 'cafeteria' })

    const tile = (await screen.findByText('Хлопців / дівчат')).closest('div') as HTMLElement
    expect(within(tile).getByText('6 / 3')).toBeInTheDocument()

    const row = screen.getByRole('cell', { name: '1-А' }).closest('tr') as HTMLElement
    const cells = within(row).getAllByRole('cell').map((cell) => cell.textContent)
    // Клас · Замовили · Хлопців · Дівчат · У реєстрі · Вартість
    expect(cells.slice(0, 5)).toEqual(['1-А', '5', '2', '3', '25'])
    expect(screen.queryByRole('columnheader', { name: 'Стать не вказано' })).not.toBeInTheDocument()
  })

  it('дітей без статі показує окремою колонкою, лише коли вони є', async () => {
    classCoverage.mockResolvedValue([coverage('c1', '1-А', 4)])
    orderGenders.mockResolvedValue(ordersOf('c1', 1, 1, 2))
    renderWithProviders(<PortionsPage />, { role: 'cafeteria' })

    expect(await screen.findByRole('columnheader', { name: 'Стать не вказано' })).toBeInTheDocument()
    expect(screen.getByText('стать не вказано: 2')).toBeInTheDocument()
  })

  // Регресія: колонка з вартістю була без заголовка — суми стояли під порожнім місцем.
  it('у розбивці по класах кожна колонка має заголовок', async () => {
    classCoverage.mockResolvedValue([coverage('c1', '1-А', 5)])
    orderGenders.mockResolvedValue(ordersOf('c1', 2, 3))
    renderWithProviders(<PortionsPage />, { role: 'cafeteria' })

    const row = (await screen.findByRole('cell', { name: '1-А' })).closest('tr') as HTMLElement
    const table = row.closest('table') as HTMLElement
    const headers = within(table).getAllByRole('columnheader')
    expect(headers).toHaveLength(within(row).getAllByRole('cell').length)
    expect(headers.at(-1)).toHaveTextContent('Вартість')
  })
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

describe('аркуш порцій: спеціальні меню', () => {
  const mi = (id: string, name: string, special: string | null) => ({
    id, menu_date: today, dish_id: `d-${id}`, price: null, special_menu_id: special,
    dishes: { id: `d-${id}`, name, category: 'second', is_active: true },
  })

  // Основне блюдо й спецменю готуються окремо — кухарю потрібне число по меню.
  it('у день зі спецменю показує порції кожного меню окремо', async () => {
    listSpecialMenus.mockResolvedValue([
      { id: 'sm1', menu_date: today, name: 'Дієтичне', created_at: '', classes: [{ id: 'c1', name: '1-А' }, { id: 'c2', name: '1-Б' }] },
    ])
    listMenuItems.mockResolvedValue([
      mi('m1', 'Гречана каша', null), mi('m2', 'Котлета', null),
      mi('s1', 'Рисова каша на воді', 'sm1'), mi('s2', 'Компот', 'sm1'),
    ])
    ordersByMenu.mockResolvedValue({ main: 70, special: { sm1: 14 } })
    renderWithProviders(<PortionsPage />, { role: 'cafeteria' })

    const special = (await screen.findByText('Дієтичне')).closest('tr') as HTMLElement
    expect(within(special).getByText('1-А, 1-Б')).toBeInTheDocument()
    expect(within(special).getByText('Компот · Рисова каша на воді')).toBeInTheDocument()
    expect(within(special).getByText('14')).toBeInTheDocument()
    const main = screen.getByText('Основне меню').closest('tr') as HTMLElement
    expect(within(main).getByText('70')).toBeInTheDocument()
    expect(within(main).getByText('Гречана каша · Котлета')).toBeInTheDocument()
  })

  it('у звичайний день розбивки за меню немає', async () => {
    renderWithProviders(<PortionsPage />, { role: 'cafeteria' })
    await screen.findByText('Порцій блюда')
    expect(screen.queryByText('Меню дня')).not.toBeInTheDocument()
    expect(ordersByMenu).not.toHaveBeenCalled()
  })
})
