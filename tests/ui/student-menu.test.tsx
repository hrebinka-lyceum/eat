import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes, useLocation } from 'react-router-dom'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { hasMoney, renderWithProviders } from '../helpers'

const day = {
  menu_date: '2026-09-01',
  status: 'published' as const,
  cutoff_at: '2026-09-01T05:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
}

// Блюдо з трьох компонентів — саме так його складає кухар.
const items = [
  { id: 'mi1', menu_date: '2026-09-01', dish_id: 'd1', dishes: { id: 'd1', name: 'Каша вівсяна', category: 'second' } },
  { id: 'mi2', menu_date: '2026-09-01', dish_id: 'd2', dishes: { id: 'd2', name: 'Чай з цукром', category: 'drink' } },
  { id: 'mi3', menu_date: '2026-09-01', dish_id: 'd3', dishes: { id: 'd3', name: 'Булочка з маком', category: 'bakery' } },
]

const student = {
  id: 's1', class_id: 'c1', last_name: 'Петренко', first_name: 'Олена', profile_id: 'u1',
  is_privileged: false, privilege_note: null, is_active: true,
  enrolled_from: '2026-09-01', left_at: null, created_at: '2026-09-01T00:00:00Z',
}

const { getStudentByProfile, getNextPublishedDay, listMenuItemsPlain, areOrdersOpen, getOrderPlain } =
  vi.hoisted(() => ({
    getStudentByProfile: vi.fn(),
    getNextPublishedDay: vi.fn(),
    listMenuItemsPlain: vi.fn(),
    areOrdersOpen: vi.fn(),
    getOrderPlain: vi.fn(),
  }))

vi.mock('@/api/students', () => ({ getStudentByProfile }))
vi.mock('@/api/menu', () => ({ getNextPublishedDay, listMenuItemsPlain, areOrdersOpen }))
vi.mock('@/api/orders', () => ({ getOrderPlain }))

const { default: StudentMenuPage } = await import('@/pages/student/StudentMenuPage')

/** Заглушка екрана підтвердження: показує, що саме передали на замовлення. */
function ConfirmProbe() {
  const state = useLocation().state as { menuDate: string; menuItemIds: string[] } | null
  return <div data-testid="probe">{state ? state.menuItemIds.join(',') : 'без стану'}</div>
}

const renderPage = () =>
  renderWithProviders(
    <Routes>
      <Route path="/me" element={<StudentMenuPage />} />
      <Route path="/me/confirm" element={<ConfirmProbe />} />
    </Routes>,
    { role: 'student', route: '/me' },
  )

beforeEach(() => {
  vi.clearAllMocks()
  getStudentByProfile.mockResolvedValue(student)
  getNextPublishedDay.mockResolvedValue(day)
  listMenuItemsPlain.mockResolvedValue(items)
  areOrdersOpen.mockResolvedValue(true)
  getOrderPlain.mockResolvedValue(null)
})

describe('екран учня', () => {
  it('показує блюдо цілком і не пропонує обирати компоненти', async () => {
    const { container } = renderPage()

    expect(await screen.findByText('Каша вівсяна')).toBeInTheDocument()
    expect(screen.getByText('Чай з цукром')).toBeInTheDocument()
    expect(screen.getByText('Булочка з маком')).toBeInTheDocument()

    // Жодних перемикачів: рішення бінарне.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: /Каша вівсяна/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Замовити' })).toBeEnabled()
    expect(hasMoney(container)).toBe(false)
  })

  // Головне: на сервер іде ВЕСЬ склад дня, а не якась його частина.
  it('замовляє весь склад блюда однією дією', async () => {
    renderPage()
    await screen.findByText('Каша вівсяна')

    await userEvent.click(screen.getByRole('button', { name: 'Замовити' }))

    expect(await screen.findByTestId('probe')).toHaveTextContent('mi1,mi2,mi3')
  })

  it('пільговий учень бачить рівно те саме', async () => {
    getStudentByProfile.mockResolvedValue({ ...student, is_privileged: true })
    renderPage()

    expect(await screen.findByText('Каша вівсяна')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Замовити' })).toBeEnabled()
    expect(screen.queryByText(/комплекс/i)).not.toBeInTheDocument()
  })

  // Регресія: вимкнений запит react-query вічно pending, і екран висів
  // на «Завантаження…» замість пояснення.
  it('учень без картки в реєстрі бачить пояснення, а не вічне завантаження', async () => {
    getStudentByProfile.mockResolvedValue(null)
    renderPage()

    expect(await screen.findByText(/ще не пов’язаний зі списком харчування/)).toBeInTheDocument()
    expect(screen.queryByText('Завантаження…')).not.toBeInTheDocument()
  })

  it('після дедлайну замовити не можна, але склад видно', async () => {
    areOrdersOpen.mockResolvedValue(false)
    renderPage()

    expect(await screen.findByText(/Час прийому замовлень минув/)).toBeInTheDocument()
    expect(screen.getByText('Каша вівсяна')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Замовити' })).not.toBeInTheDocument()
  })

  it('порожній день не пропонує замовляти порожнечу', async () => {
    listMenuItemsPlain.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText(/ще не складено/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Замовити' })).not.toBeInTheDocument()
  })
})
