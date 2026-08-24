import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { hasMoney, renderWithProviders } from '../helpers'

const day = {
  menu_date: '2026-09-01',
  status: 'published' as const,
  cutoff_at: '2026-09-01T05:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
}

const { listMenuDays, listMenuItemsPlainForDates } = vi.hoisted(() => ({
  listMenuDays: vi.fn(),
  listMenuItemsPlainForDates: vi.fn(),
}))

vi.mock('@/api/menu', () => ({ listMenuDays, listMenuItemsPlainForDates }))

const { default: TeacherMenuPage } = await import('@/pages/teacher/TeacherMenuPage')

beforeEach(() => {
  listMenuDays.mockResolvedValue([day])
  listMenuItemsPlainForDates.mockResolvedValue([
    { id: 'mi1', menu_date: '2026-09-01', dish_id: 'd1', dishes: { id: 'd1', name: 'Борщ український', category: 'first' } },
    { id: 'mi2', menu_date: '2026-09-01', dish_id: 'd2', dishes: { id: 'd2', name: 'Котлета з пюре', category: 'second' } },
  ])
})

describe('меню очима класного керівника', () => {
  it('показує склад дня без жодної суми', async () => {
    const { container } = renderWithProviders(<TeacherMenuPage />, { role: 'teacher' })

    expect(await screen.findByText('Борщ український')).toBeInTheDocument()
    expect(hasMoney(container)).toBe(false)
  })

  it('запитує лише опубліковані дні — чернетка ще змінюється', async () => {
    renderWithProviders(<TeacherMenuPage />, { role: 'teacher' })
    await screen.findByText('Борщ український')

    expect(listMenuDays).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      { status: 'published' },
    )
  })
})
