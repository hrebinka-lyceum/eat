import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'
import { toIsoDate } from '@/lib/format'
import { shiftIso } from '@/lib/dates'

const api = vi.hoisted(() => ({
  listClasses: vi.fn(),
  listStudentsOfClass: vi.fn(),
  listMenuDays: vi.fn(),
  getClassMenu: vi.fn(),
  areOrdersOpen: vi.fn(),
  listOrdersPlainOfClass: vi.fn(),
  placeOrder: vi.fn(),
  cancelOrder: vi.fn(),
}))

vi.mock('@/api/settings', () => ({ getSettings: vi.fn(async () => ({ current_year: '2026/2027' })) }))
vi.mock('@/api/classes', () => ({ listClasses: api.listClasses }))
vi.mock('@/api/students', () => ({ listStudentsOfClass: api.listStudentsOfClass }))
vi.mock('@/api/menu', () => ({
  listMenuDays: api.listMenuDays,
  getClassMenu: api.getClassMenu,
  areOrdersOpen: api.areOrdersOpen,
}))
vi.mock('@/api/orders', () => ({
  listOrdersPlainOfClass: api.listOrdersPlainOfClass,
  placeOrder: api.placeOrder,
  cancelOrder: api.cancelOrder,
}))

const { default: ReorderPage } = await import('@/pages/admin/ReorderPage')

const today = toIsoDate()
const day = (menu_date: string) => ({
  menu_date, status: 'published' as const, cutoff_at: `${menu_date}T06:00:00Z`, created_at: menu_date,
})
const student = (id: string, last_name: string, first_name: string) => ({
  id, class_id: 'c7', last_name, first_name, profile_id: null, is_privileged: false,
  privilege_note: null, privilege_category_ids: [], gender: null, is_active: true,
  enrolled_from: '2026-09-01', left_at: null, created_at: '',
})

beforeEach(() => {
  vi.clearAllMocks()
  api.listClasses.mockResolvedValue([
    { id: 'c1', name: '1-А', academic_year: '2026/2027', teacher_id: null, total_students: 20 },
    { id: 'c7', name: '7-А', academic_year: '2026/2027', teacher_id: null, total_students: 27 },
  ])
  // Завтрашній день першим у списку — а показати має сьогоднішній.
  api.listMenuDays.mockResolvedValue([day(today), day(shiftIso(today, 1))])
  api.getClassMenu.mockResolvedValue({
    special: null,
    items: [
      { id: 'mi1', menu_date: today, dish_id: 'd1', special_menu_id: null, dishes: { id: 'd1', name: 'Гречана каша', category: 'second' } },
      { id: 'mi2', menu_date: today, dish_id: 'd2', special_menu_id: null, dishes: { id: 'd2', name: 'Чай', category: 'second' } },
    ],
  })
  api.areOrdersOpen.mockResolvedValue(false)
  api.listStudentsOfClass.mockResolvedValue([
    student('s1', 'Бойко', 'Анна'),
    student('s2', 'Мороз', 'Злата'),
  ])
  api.listOrdersPlainOfClass.mockResolvedValue([
    { id: 'o1', menu_date: today, student_id: 's1', class_id: 'c7', privileged_at_order: false,
      after_cutoff: false, created_at: '', order_items: [] },
  ])
  api.placeOrder.mockResolvedValue('o2')
})

async function chooseClass(name: string) {
  await userEvent.click(await screen.findByLabelText('Клас'))
  await userEvent.click(await screen.findByRole('option', { name }))
}

describe('дозамовлення', () => {
  it('спершу просить обрати клас', async () => {
    renderWithProviders(<ReorderPage />, { role: 'admin' })
    expect(await screen.findByText('Спершу оберіть клас')).toBeInTheDocument()
    expect(api.listStudentsOfClass).not.toHaveBeenCalled()
  })

  it('показує, хто вже має замовлення, і дає дозамовити решті', async () => {
    renderWithProviders(<ReorderPage />, { role: 'admin' })
    await chooseClass('7-А')

    const ordered = (await screen.findByText('Бойко Анна')).closest('tr') as HTMLElement
    expect(within(ordered).getByText('Замовлено')).toBeInTheDocument()
    expect(within(ordered).queryByRole('button', { name: /Дозамовити/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Дозамовити для Мороз Злата' })).toBeEnabled()
    expect(api.listOrdersPlainOfClass).toHaveBeenCalledWith('c7', today)
  })

  // Після дедлайну замовлення приймається, але має бути видно, що воно пізнє.
  it('після дедлайну попереджає і замовляє весь склад дня', async () => {
    renderWithProviders(<ReorderPage />, { role: 'admin' })
    expect(await screen.findByText('Прийом замовлень на цей день уже закрито')).toBeInTheDocument()
    await chooseClass('7-А')

    await userEvent.click(await screen.findByRole('button', { name: 'Дозамовити для Мороз Злата' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/позначиться як пізнє/)).toBeInTheDocument()
    expect(api.placeOrder).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Дозамовити' }))
    expect(api.placeOrder).toHaveBeenCalledWith('s2', today, ['mi1', 'mi2'])
  })

  it('без складеного блюда дозамовити не можна', async () => {
    api.getClassMenu.mockResolvedValue({ special: null, items: [] })
    renderWithProviders(<ReorderPage />, { role: 'admin' })
    await chooseClass('7-А')

    expect(await screen.findByText(/Ще не складено/)).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Дозамовити для Мороз Злата' })).toBeDisabled()
  })

  it('пошук звужує список класу', async () => {
    renderWithProviders(<ReorderPage />, { role: 'admin' })
    await chooseClass('7-А')
    await screen.findByText('Бойко Анна')

    await userEvent.type(screen.getByLabelText('Пошук у класі'), 'моро')
    expect(screen.queryByText('Бойко Анна')).not.toBeInTheDocument()
    expect(screen.getByText('Мороз Злата')).toBeInTheDocument()
  })

  // Склад залежить від класу: дозамовляючи в клас зі спецменю, адміністратор
  // бачить саме його — і сервер покладе в замовлення саме його.
  it('у класу зі спеціальним меню показує склад цього меню', async () => {
    api.getClassMenu.mockImplementation(async (_date: string, classId: string) =>
      classId === 'c1'
        ? {
            special: { id: 'sm1', name: 'Для 1–4 класів' },
            items: [{ id: 's1', menu_date: today, dish_id: 'd9', special_menu_id: 'sm1', dishes: { id: 'd9', name: 'Сирники', category: 'second' } }],
          }
        : { special: null, items: [] },
    )
    renderWithProviders(<ReorderPage />, { role: 'admin' })
    await chooseClass('1-А')

    expect(await screen.findByText('Для 1–4 класів для 1-А на цей день')).toBeInTheDocument()
    expect(screen.getByText('Сирники')).toBeInTheDocument()
    expect(api.getClassMenu).toHaveBeenCalledWith(today, 'c1')
  })

  // Адміністрація скасовує будь-коли, але після дедлайну попереджаємо: кухня
  // могла вже порахувати порції.
  it('скасовує замовлення й після дедлайну — з попередженням для кухні', async () => {
    api.cancelOrder.mockResolvedValue(undefined)
    renderWithProviders(<ReorderPage />, { role: 'admin' })
    await chooseClass('7-А')

    await userEvent.click(await screen.findByRole('button', { name: 'Скасувати замовлення для Бойко Анна' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/кухня могла порахувати порції/)).toBeInTheDocument()
    expect(api.cancelOrder).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Скасувати замовлення' }))
    await vi.waitFor(() => expect(api.cancelOrder).toHaveBeenCalledWith('o1'))
  })

  it('до дедлайну попередження про кухню немає', async () => {
    api.areOrdersOpen.mockResolvedValue(true)
    renderWithProviders(<ReorderPage />, { role: 'admin' })
    await chooseClass('7-А')

    await userEvent.click(await screen.findByRole('button', { name: 'Скасувати замовлення для Бойко Анна' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).queryByText(/кухня могла порахувати порції/)).not.toBeInTheDocument()
  })
})
