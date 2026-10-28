import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

const { getNextEmptyDay, getMenuDay, listMenuItems, listDishes } = vi.hoisted(() => ({
  getNextEmptyDay: vi.fn(),
  getMenuDay: vi.fn(),
  listMenuItems: vi.fn(),
  listDishes: vi.fn(),
}))

vi.mock('@/api/menu', () => ({
  getNextEmptyDay,
  getMenuDay,
  listMenuItems,
  addMenuItem: vi.fn(),
  removeMenuItem: vi.fn(),
  setMenuItemPrice: vi.fn(),
  createMenuDay: vi.fn(),
  setMenuDayStatus: vi.fn(),
  generateMenuDays: vi.fn(),
  copyMenu: vi.fn(),
}))
vi.mock('@/api/dishes', () => ({ listDishes }))

const { default: MenuEditorPage } = await import('@/pages/cafeteria/MenuEditorPage')

const DATE = '2026-09-01'
const day = {
  menu_date: DATE, status: 'draft' as const,
  cutoff_at: '2026-09-30T05:00:00Z', created_at: DATE,
}
const menuItem = (id: string, name: string, category: string) => ({
  id, menu_date: DATE, dish_id: `d${id}`, price: 24.5,
  dishes: { id: `d${id}`, name, category, is_active: true },
})

beforeEach(() => {
  // Стан «днів меню ще немає» — саме на ньому екран колись падав.
  getNextEmptyDay.mockResolvedValue(null)
  getMenuDay.mockResolvedValue(null)
  listMenuItems.mockResolvedValue([])
  listDishes.mockResolvedValue([])
})

describe('редактор меню', () => {
  it('показує одне поле вартості на все блюдо, а не ціну кожного компонента', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      { ...menuItem('mi1', 'Гречана каша', 'second'), price: 62.5 },
      { ...menuItem('mi2', 'Котлета', 'second'), price: null },
      { ...menuItem('mi3', 'Чай', 'drink'), price: null },
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Гречана каша')

    // Одне поле на все блюдо; сума лежить на одному компоненті, але кухар
    // бачить її як вартість блюда.
    const price = screen.getByLabelText('Вартість блюда') as HTMLInputElement
    expect(price.value).toBe('62.5')
    expect(screen.getByText('Компонентів: 3')).toBeInTheDocument()
  })

  it('без указаної вартості попереджає, що день додасть нуль', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      { ...menuItem('mi1', 'Гречана каша', 'second'), price: null },
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })

    expect(await screen.findByText(/Вартість блюда ще не вказана/)).toBeInTheDocument()
  })

  // Склад блюда — справа їдальні: будь-які компоненти в будь-якій кількості.
  it('дозволяє скласти блюдо з довільних компонентів', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      menuItem('mi1', 'Гречана каша', 'second'),
      menuItem('mi2', 'Котлета', 'second'),
      menuItem('mi3', 'Чай', 'drink'),
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Гречана каша')

    expect(screen.getByText('Котлета')).toBeInTheDocument()
    expect(screen.getByText('Чай')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Опублікувати/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('порожнє блюдо опублікувати не можна', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Блюдо на цей день ще не складено')

    await userEvent.click(screen.getByRole('button', { name: /Опублікувати/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('складене блюдо публікується без перешкод', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      menuItem('mi1', 'Каша вівсяна', 'second'),
      menuItem('mi2', 'Чай з цукром', 'drink'),
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Каша вівсяна')

    expect(screen.getByText('Чай з цукром')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Опублікувати/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  // Регресія: пропси закритого ConfirmDialog обчислювалися завжди, і
  // formatCutoff('') кидав RangeError — увесь екран лишався порожнім.
  it('коли дня меню ще немає, показує картку створення, а не білий екран', async () => {
    const { container } = renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })

    expect(await screen.findByText(/ще не створено/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Створити день' })).toBeInTheDocument()
    expect(container.textContent).toContain('Редактор меню')
  })

  it('без дня публікувати нічого — кнопка неактивна', async () => {
    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    expect(await screen.findByRole('button', { name: /Опублікувати/ })).toBeDisabled()
  })
})
