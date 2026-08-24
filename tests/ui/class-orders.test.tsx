import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { hasMoney, renderWithProviders } from '../helpers'

const {
  getSettings, getClassOfTeacher, listStudentsOfClass,
  listMenuDays, listMenuItemsPlain, areOrdersOpen,
  listOrdersPlainOfClass, placeOrder,
} = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getClassOfTeacher: vi.fn(),
  listStudentsOfClass: vi.fn(),
  listMenuDays: vi.fn(),
  listMenuItemsPlain: vi.fn(),
  areOrdersOpen: vi.fn(),
  listOrdersPlainOfClass: vi.fn(),
  placeOrder: vi.fn(),
}))

vi.mock('@/api/settings', () => ({ getSettings }))
vi.mock('@/api/classes', () => ({ getClassOfTeacher }))
vi.mock('@/api/students', () => ({ listStudentsOfClass }))
vi.mock('@/api/menu', () => ({ listMenuDays, listMenuItemsPlain, areOrdersOpen }))
vi.mock('@/api/orders', () => ({ listOrdersPlainOfClass, placeOrder }))

const { default: ClassOrdersPage } = await import('@/pages/teacher/ClassOrdersPage')

const DATE = '2026-09-01'

const day = {
  menu_date: DATE,
  status: 'published' as const,
  cutoff_at: '2026-09-01T05:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
}

const item = (id: string, name: string, category: string) => ({
  id, menu_date: DATE, dish_id: `d${id}`, dishes: { id: `d${id}`, name, category },
})

const items = [
  item('mi1', 'Борщ український', 'first'),
  item('mi2', 'Суп курячий', 'first'),
  item('mi3', 'Котлета з пюре', 'second'),
]

const student = (id: string, last: string, over: Record<string, unknown> = {}) => ({
  id, class_id: 'c1', last_name: last, first_name: 'Тест', profile_id: null,
  is_privileged: false, privilege_note: null, is_active: true,
  enrolled_from: DATE, left_at: null, created_at: DATE, ...over,
})

const students = [
  student('s1', 'Іваненко'),
  student('s2', 'Петренко', { is_privileged: true }),
  student('s3', 'Сидоренко'),
]

beforeEach(() => {
  // restoreMocks з конфігу не чистить заглушки, створені через vi.hoisted,
  // тож історію викликів обнуляємо явно — інакше вона тече між тестами.
  vi.clearAllMocks()

  getSettings.mockResolvedValue({
    id: true, cutoff_time: '08:00', cutoff_days_before: 0, timezone: 'Europe/Kyiv',
    current_year: '2026/2027', login_domain: 'school.local',
  })
  getClassOfTeacher.mockResolvedValue({
    id: 'c1', name: '7-А', academic_year: '2026/2027', teacher_id: 'u1', total_students: 28,
  })
  listStudentsOfClass.mockResolvedValue(students)
  listMenuDays.mockResolvedValue([day])
  listMenuItemsPlain.mockResolvedValue(items)
  areOrdersOpen.mockResolvedValue(true)
  listOrdersPlainOfClass.mockResolvedValue([])
  placeOrder.mockResolvedValue('order-1')
})

const renderPage = () => renderWithProviders(<ClassOrdersPage />, { role: 'teacher' })
const box = (dish: string, last: string) =>
  screen.getByRole('checkbox', { name: `${dish} для ${last}` })

describe('замовлення за клас', () => {
  it('показує учнів і страви дня без жодної суми', async () => {
    const { container } = renderPage()

    expect(await screen.findByText('Іваненко Тест')).toBeInTheDocument()
    expect(screen.getByText('Борщ український')).toBeInTheDocument()
    expect(hasMoney(container)).toBe(false)
  })

  it('пільговий учень має такі самі чекбокси, як усі', async () => {
    renderPage()
    await screen.findByText('Петренко Тест')

    // Пільга лишається позначкою, але не режимом «комплекс без вибору».
    expect(screen.getByText('Пільга')).toBeInTheDocument()
    expect(box('Борщ український', 'Петренко')).toBeInTheDocument()
  })

  // Те саме правило перевіряє place_order на сервері; UI не має його порушувати.
  it('у першій страві вибір заміщується, а не додається', async () => {
    renderPage()
    await screen.findByText('Іваненко Тест')

    await userEvent.click(box('Борщ український', 'Іваненко'))
    await userEvent.click(box('Суп курячий', 'Іваненко'))

    expect(box('Борщ український', 'Іваненко')).not.toBeChecked()
    expect(box('Суп курячий', 'Іваненко')).toBeChecked()
  })

  it('перше й друге можна обрати одночасно', async () => {
    renderPage()
    await screen.findByText('Іваненко Тест')

    await userEvent.click(box('Борщ український', 'Іваненко'))
    await userEvent.click(box('Котлета з пюре', 'Іваненко'))

    expect(box('Борщ український', 'Іваненко')).toBeChecked()
    expect(box('Котлета з пюре', 'Іваненко')).toBeChecked()
  })

  it('«усім» відмічає страву кожному, хто ще не замовив', async () => {
    listOrdersPlainOfClass.mockResolvedValue([
      {
        id: 'o1', menu_date: DATE, student_id: 's3', class_id: 'c1',
        privileged_at_order: false, after_cutoff: false, created_at: DATE,
        order_items: [{ id: 'oi1', menu_items: { id: 'mi1', dishes: { id: 'd1', name: 'Борщ український', category: 'first' } } }],
      },
    ])
    renderPage()
    await screen.findByText('Іваненко Тест')

    const header = screen.getByText('Борщ український').closest('th')!
    await userEvent.click(within(header).getByRole('button', { name: 'усім' }))

    expect(box('Борщ український', 'Іваненко')).toBeChecked()
    expect(box('Борщ український', 'Петренко')).toBeChecked()
    // Сидоренко вже замовив — його рядок лише для читання.
    expect(screen.getByText(/Замовлено: Борщ український/)).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /для Сидоренко/ })).not.toBeInTheDocument()
  })

  it('замовляє через place_order по одному виклику на учня', async () => {
    renderPage()
    await screen.findByText('Іваненко Тест')

    await userEvent.click(box('Борщ український', 'Іваненко'))
    await userEvent.click(box('Котлета з пюре', 'Петренко'))
    await userEvent.click(screen.getByRole('button', { name: 'Замовити' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Замовлення незмінне/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Замовити' }))

    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(2))
    expect(placeOrder).toHaveBeenCalledWith('s1', DATE, ['mi1'])
    expect(placeOrder).toHaveBeenCalledWith('s2', DATE, ['mi3'])
  })

  it('якщо частина замовлень не пройшла — винних названо поіменно', async () => {
    placeOrder
      .mockResolvedValueOnce('order-1')
      .mockRejectedValueOnce(new Error('Замовлення на 2026-09-01 вже зроблено'))

    renderPage()
    await screen.findByText('Іваненко Тест')

    await userEvent.click(box('Борщ український', 'Іваненко'))
    await userEvent.click(box('Борщ український', 'Петренко'))
    await userEvent.click(screen.getByRole('button', { name: 'Замовити' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Замовити' }))

    const alert = (await screen.findByText('Частина замовлень не пройшла')).closest(
      '[role="alert"]',
    ) as HTMLElement
    // Ім'я є і в таблиці, тому шукаємо саме в повідомленні про невдачу.
    expect(within(alert).getByText('Петренко Тест')).toBeInTheDocument()
    expect(within(alert).getByText(/вже зроблено/)).toBeInTheDocument()
  })

  it('після дедлайну замовляти не можна, але видно, хто вже замовив', async () => {
    areOrdersOpen.mockResolvedValue(false)
    renderPage()

    // Спершу таблиця: банер про дедлайн з'являється раніше за неї,
    // бо його запит легший.
    await screen.findByText('Іваненко Тест')
    expect(screen.getByText(/Час прийому замовлень на цей день минув/)).toBeInTheDocument()
    expect(box('Борщ український', 'Іваненко')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'усім' })).not.toBeInTheDocument()
  })

  it('без опублікованих днів пропонує звернутися до їдальні', async () => {
    listMenuDays.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('Немає опублікованих днів')).toBeInTheDocument()
    expect(placeOrder).not.toHaveBeenCalled()
  })

  it('керівник без класу бачить пояснення, а не порожню таблицю', async () => {
    getClassOfTeacher.mockResolvedValue(null)
    renderPage()

    expect(
      await screen.findByText(/За вами не закріплено клас/),
    ).toBeInTheDocument()
  })
})
