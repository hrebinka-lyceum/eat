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
  // Склад сніданку — справа їдальні. Після зміни place_order сервер бере
  // весь склад дня й нічого не перевіряє за категоріями, тож дві перші
  // страви в одному сніданку цілком законні.
  it('дозволяє скласти сніданок із двох страв однієї категорії', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      menuItem('mi1', 'Борщ український', 'first'),
      menuItem('mi2', 'Суп курячий', 'first'),
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Борщ український')

    expect(screen.queryByText(/неможливо замовити/)).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Опублікувати/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('порожній сніданок опублікувати не можна', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Сніданок на цей день ще не складено')

    await userEvent.click(screen.getByRole('button', { name: /Опублікувати/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('коректний сніданок публікується без перешкод', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      menuItem('mi1', 'Каша вівсяна', 'second'),
      menuItem('mi2', 'Чай з цукром', 'drink'),
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Каша вівсяна')

    expect(screen.queryByText('Цей сніданок неможливо замовити')).not.toBeInTheDocument()
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
