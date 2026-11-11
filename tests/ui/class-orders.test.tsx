import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { hasMoney, renderWithProviders } from '../helpers'

const {
  getSettings, getClassOfTeacher, listStudentsOfClass,
  listMenuDays, getClassMenu, areOrdersOpen,
  listOrdersPlainOfClass, placeOrder, cancelOrder,
} = vi.hoisted(() => ({
  getSettings: vi.fn(),
  getClassOfTeacher: vi.fn(),
  listStudentsOfClass: vi.fn(),
  listMenuDays: vi.fn(),
  getClassMenu: vi.fn(),
  areOrdersOpen: vi.fn(),
  listOrdersPlainOfClass: vi.fn(),
  placeOrder: vi.fn(),
  cancelOrder: vi.fn(),
}))

vi.mock('@/api/settings', () => ({ getSettings }))
vi.mock('@/api/classes', () => ({ getClassOfTeacher }))
vi.mock('@/api/students', () => ({ listStudentsOfClass }))
vi.mock('@/api/menu', () => ({ listMenuDays, getClassMenu, areOrdersOpen }))
vi.mock('@/api/orders', () => ({ listOrdersPlainOfClass, placeOrder, cancelOrder }))

const { default: ClassOrdersPage } = await import('@/pages/teacher/ClassOrdersPage')

const DATE = '2026-09-01'

const day = {
  menu_date: DATE,
  status: 'published' as const,
  cutoff_at: '2026-09-01T05:00:00Z',
  created_at: '2026-09-01T00:00:00Z',
}

const item = (id: string, name: string, category: string) => ({
  id, menu_date: DATE, dish_id: `d${id}`, special_menu_id: null, dishes: { id: `d${id}`, name, category },
})

// Блюдо дня — кілька компонентів, які беруться цілком.
const items = [
  item('mi1', 'Борщ український', 'first'),
  item('mi2', 'Котлета з пюре', 'second'),
  item('mi3', 'Компот', 'drink'),
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
  getClassMenu.mockResolvedValue({ special: null, items })
  areOrdersOpen.mockResolvedValue(true)
  listOrdersPlainOfClass.mockResolvedValue([])
  placeOrder.mockResolvedValue('order-1')
})

const renderPage = () => renderWithProviders(<ClassOrdersPage />, { role: 'teacher' })
const box = (last: string) => screen.getByRole('checkbox', { name: `Блюдо для ${last}` })
const allBox = () => screen.getByRole('checkbox', { name: 'Обрати всіх, хто ще не замовив' })

describe('замовлення за клас', () => {
  it('показує склад блюда й одну галочку на учня — без жодної суми', async () => {
    const { container } = renderPage()

    expect(await screen.findByText('Іваненко Тест')).toBeInTheDocument()
    expect(screen.getByText('Блюдо на цей день')).toBeInTheDocument()
    expect(screen.getByText(/Борщ український · Компот · Котлета з пюре/)).toBeInTheDocument()

    // Одна галочка на учня, а не сітка «учень × компоненти».
    expect(box('Іваненко')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /Борщ український для/ })).not.toBeInTheDocument()
    expect(hasMoney(container)).toBe(false)
  })

  it('пільговий учень — така сама галочка, лише з позначкою', async () => {
    renderPage()
    await screen.findByText('Петренко Тест')

    expect(screen.getByText('Пільга')).toBeInTheDocument()
    expect(box('Петренко')).toBeInTheDocument()
  })

  it('«обрати всіх» відмічає кожного, хто ще не замовив', async () => {
    listOrdersPlainOfClass.mockResolvedValue([
      {
        id: 'o1', menu_date: DATE, student_id: 's3', class_id: 'c1',
        privileged_at_order: false, after_cutoff: false, created_at: DATE,
        order_items: [{ id: 'oi1', menu_items: { id: 'mi1', dishes: { id: 'd1', name: 'Борщ український', category: 'first' } } }],
      },
    ])
    renderPage()
    await screen.findByText('Іваненко Тест')

    await userEvent.click(allBox())

    expect(box('Іваненко')).toBeChecked()
    expect(box('Петренко')).toBeChecked()
    // Сидоренко вже замовив — галочки в нього немає взагалі.
    expect(screen.getByText('Замовлено')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /для Сидоренко/ })).not.toBeInTheDocument()
  })

  // Головне: кожному обраному замовляється ВЕСЬ склад дня.
  it('замовляє все блюдо кожному обраному окремим викликом', async () => {
    renderPage()
    await screen.findByText('Іваненко Тест')

    await userEvent.click(box('Іваненко'))
    await userEvent.click(box('Петренко'))
    await userEvent.click(screen.getByRole('button', { name: 'Замовити' }))

    const dialog = await screen.findByRole('dialog')
    // Керівник знає, до котрої години ще можна передумати.
    expect(within(dialog).getByText(/Скасувати замовлення можна до .* червоним хрестиком/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Замовити' }))

    await waitFor(() => expect(placeOrder).toHaveBeenCalledTimes(2))
    // Порядок позицій неважливий — сервер їх однаково ігнорує; важливо,
    // що йде ВЕСЬ склад дня, а не частина.
    for (const studentId of ['s1', 's2']) {
      const call = placeOrder.mock.calls.find((args) => args[0] === studentId)!
      expect(call[1]).toBe(DATE)
      expect([...(call[2] as string[])].sort()).toEqual(['mi1', 'mi2', 'mi3'])
    }
  })

  it('якщо частина замовлень не пройшла — винних названо поіменно', async () => {
    placeOrder
      .mockResolvedValueOnce('order-1')
      .mockRejectedValueOnce(new Error('Замовлення на 2026-09-01 вже зроблено'))

    renderPage()
    await screen.findByText('Іваненко Тест')

    await userEvent.click(box('Іваненко'))
    await userEvent.click(box('Петренко'))
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
    expect(box('Іваненко')).toBeDisabled()
    expect(screen.queryByRole('checkbox', { name: 'Обрати всіх, хто ще не замовив' })).not.toBeInTheDocument()
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

    expect(await screen.findByText(/За вами не закріплено клас/)).toBeInTheDocument()
  })

  // Клас у спеціальному меню: керівник бачить саме його і знає, що це не основне.
  it('клас у спеціальному меню бачить його склад і назву', async () => {
    getClassMenu.mockResolvedValue({
      special: { id: 'sm1', name: 'Дієтичне' },
      items: [item('s1', 'Рисова каша на воді', 'second'), item('s2', 'Компот', 'drink')],
    })

    renderWithProviders(<ClassOrdersPage />, { role: 'teacher' })

    expect(await screen.findByText('Дієтичне для вашого класу на цей день')).toBeInTheDocument()
    expect(screen.getByText('Компот · Рисова каша на воді')).toBeInTheDocument()
    expect(getClassMenu).toHaveBeenCalledWith(DATE, 'c1')
  })

  it('порожнє спецменю — не пропонує замовляти й пояснює чому', async () => {
    getClassMenu.mockResolvedValue({ special: { id: 'sm1', name: '' }, items: [] })

    renderWithProviders(<ClassOrdersPage />, { role: 'teacher' })

    expect(
      await screen.findByText('Спеціальне меню для вашого класу на цей день ще не складено'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })

  // Скасування — до того самого часу, що й замовлення: червоний хрестик біля
  // «Замовлено» і обов'язкове підтвердження.
  describe('скасування', () => {
    const ordered = {
      id: 'o-sid', menu_date: DATE, student_id: 's3', class_id: 'c1',
      privileged_at_order: false, after_cutoff: false, created_at: DATE,
      order_items: [{ id: 'oi1', menu_items: { id: 'mi1', dishes: { id: 'd1', name: 'Борщ український', category: 'first' } } }],
    }

    it('до дедлайну хрестик скасовує замовлення лише після підтвердження', async () => {
      listOrdersPlainOfClass.mockResolvedValue([ordered])
      cancelOrder.mockResolvedValue(undefined)
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'Скасувати замовлення для Сидоренко Тест' }))
      const dialog = await screen.findByRole('dialog')
      expect(within(dialog).getByText(/блюдо для Сидоренко Тест не готуватимуть/)).toBeInTheDocument()
      expect(cancelOrder).not.toHaveBeenCalled()

      await userEvent.click(within(dialog).getByRole('button', { name: 'Скасувати замовлення' }))
      await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith('o-sid'))
    })

    it('«Залишити» закриває вікно й нічого не скасовує', async () => {
      listOrdersPlainOfClass.mockResolvedValue([ordered])
      renderPage()

      await userEvent.click(await screen.findByRole('button', { name: 'Скасувати замовлення для Сидоренко Тест' }))
      await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Залишити' }))

      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(cancelOrder).not.toHaveBeenCalled()
    })

    it('після дедлайну хрестика немає — скасовує лише адміністратор', async () => {
      areOrdersOpen.mockResolvedValue(false)
      listOrdersPlainOfClass.mockResolvedValue([ordered])
      renderPage()

      await screen.findByText('Сидоренко Тест')
      await screen.findByText(/Час прийому замовлень на цей день минув/)
      expect(screen.queryByRole('button', { name: /Скасувати замовлення/ })).not.toBeInTheDocument()
    })
  })
})
