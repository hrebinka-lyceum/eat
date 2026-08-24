import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { hasMoney, renderWithProviders } from '../helpers'

const day = {
  menu_date: '2026-09-01',
  status: 'published' as const,
  cutoff_at: '2026-09-01T05:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
}

const items = [
  { id: 'mi1', menu_date: '2026-09-01', dish_id: 'd1', dishes: { id: 'd1', name: 'Борщ український', category: 'first' as const } },
  { id: 'mi2', menu_date: '2026-09-01', dish_id: 'd2', dishes: { id: 'd2', name: 'Суп курячий', category: 'first' as const } },
  { id: 'mi3', menu_date: '2026-09-01', dish_id: 'd3', dishes: { id: 'd3', name: 'Котлета з пюре', category: 'second' as const } },
]

const student = {
  id: 's1', class_id: 'c1', last_name: 'Петренко', first_name: 'Олена', profile_id: 'u1',
  is_privileged: true, privilege_note: null, is_active: true,
  enrolled_from: '2026-09-01', left_at: null, created_at: '2026-09-01T00:00:00Z',
}

// vi.mock піднімається над файлом, тож самі заглушки створюємо через
// vi.hoisted — інакше вони ще не існують на момент підміни модуля.
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

beforeEach(() => {
  getNextPublishedDay.mockResolvedValue(day)
  listMenuItemsPlain.mockResolvedValue(items)
  areOrdersOpen.mockResolvedValue(true)
  getOrderPlain.mockResolvedValue(null)
})

describe('екран учня', () => {
  it('пільговий учень обирає страви так само, як усі', async () => {
    getStudentByProfile.mockResolvedValue(student)
    const { container } = renderWithProviders(<StudentMenuPage />, { role: 'student' })

    expect(await screen.findByText('Борщ український')).toBeInTheDocument()
    // Жодного «комплексу без вибору» — це поведінка, яку прибрали свідомо.
    expect(screen.queryByText(/комплекс/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Обери страви/ })).toBeDisabled()
    expect(hasMoney(container)).toBe(false)
  })

  it('у першій страві вибір заміщується, а не додається', async () => {
    getStudentByProfile.mockResolvedValue({ ...student, is_privileged: false })
    renderWithProviders(<StudentMenuPage />, { role: 'student' })

    const borshch = await screen.findByRole('button', { name: /Борщ український/ })
    await userEvent.click(borshch)
    await userEvent.click(screen.getByRole('button', { name: /Суп курячий/ }))

    expect(borshch).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /Суп курячий/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /Далі — обрано 1/ })).toBeEnabled()
  })

  // Регресія: вимкнений запит react-query вічно pending, і екран висів
  // на «Завантаження…» замість пояснення.
  it('учень без картки в реєстрі бачить пояснення, а не вічне завантаження', async () => {
    getStudentByProfile.mockResolvedValue(null)
    renderWithProviders(<StudentMenuPage />, { role: 'student' })

    expect(await screen.findByText(/ще не пов’язаний зі списком харчування/)).toBeInTheDocument()
    expect(screen.queryByText('Завантаження…')).not.toBeInTheDocument()
  })

  it('після дедлайну замовити не можна, але меню видно', async () => {
    getStudentByProfile.mockResolvedValue({ ...student, is_privileged: false })
    areOrdersOpen.mockResolvedValueOnce(false)
    renderWithProviders(<StudentMenuPage />, { role: 'student' })

    await waitFor(() => expect(screen.getByText(/Час прийому замовлень минув/)).toBeInTheDocument())
    expect(screen.getByText('Борщ український')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Обери страви|Далі/ })).not.toBeInTheDocument()
  })
})
