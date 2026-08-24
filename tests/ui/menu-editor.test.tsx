import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
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

beforeEach(() => {
  // Стан «днів меню ще немає» — саме на ньому екран колись падав.
  getNextEmptyDay.mockResolvedValue(null)
  getMenuDay.mockResolvedValue(null)
  listMenuItems.mockResolvedValue([])
  listDishes.mockResolvedValue([])
})

describe('редактор меню', () => {
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
