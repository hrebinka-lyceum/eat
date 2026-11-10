import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { hasMoney, renderWithProviders } from '../helpers'

const day = {
  menu_date: '2026-09-01',
  status: 'published' as const,
  cutoff_at: '2026-09-01T05:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
}

const { listMenuDays, getClassMenus } = vi.hoisted(() => ({
  listMenuDays: vi.fn(),
  getClassMenus: vi.fn(),
}))

vi.mock('@/api/menu', () => ({ listMenuDays, getClassMenus }))
vi.mock('@/api/settings', () => ({ getSettings: vi.fn(async () => ({ current_year: '2026/2027' })) }))
vi.mock('@/api/classes', () => ({
  getClassOfTeacher: vi.fn(async () => ({ id: 'c1', name: '7-А', academic_year: '2026/2027', teacher_id: 'u1', total_students: null })),
}))

const { default: TeacherMenuPage } = await import('@/pages/teacher/TeacherMenuPage')

beforeEach(() => {
  listMenuDays.mockResolvedValue([day])
  getClassMenus.mockResolvedValue({
    '2026-09-01': {
      special: null,
      items: [
        { id: 'mi1', menu_date: '2026-09-01', dish_id: 'd1', special_menu_id: null, dishes: { id: 'd1', name: 'Борщ український', category: 'first' } },
        { id: 'mi2', menu_date: '2026-09-01', dish_id: 'd2', special_menu_id: null, dishes: { id: 'd2', name: 'Котлета з пюре', category: 'second' } },
      ],
    },
  })
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

  it('день, коли клас у спеціальному меню, позначено його назвою', async () => {
    getClassMenus.mockResolvedValue({
      '2026-09-01': {
        special: { id: 'sm1', name: 'Без глютену' },
        items: [{ id: 's1', menu_date: '2026-09-01', dish_id: 'd9', special_menu_id: 'sm1', dishes: { id: 'd9', name: 'Гречана каша', category: 'second' } }],
      },
    })
    renderWithProviders(<TeacherMenuPage />, { role: 'teacher' })

    expect(await screen.findByText('Без глютену')).toBeInTheDocument()
    expect(screen.getByText('Гречана каша')).toBeInTheDocument()
    expect(getClassMenus).toHaveBeenCalledWith(['2026-09-01'], 'c1')
  })
})
