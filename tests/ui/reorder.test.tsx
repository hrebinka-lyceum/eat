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
  listMenuItemsPlain: vi.fn(),
  areOrdersOpen: vi.fn(),
  listOrdersPlainOfClass: vi.fn(),
  placeOrder: vi.fn(),
}))

vi.mock('@/api/settings', () => ({ getSettings: vi.fn(async () => ({ current_year: '2026/2027' })) }))
vi.mock('@/api/classes', () => ({ listClasses: api.listClasses }))
vi.mock('@/api/students', () => ({ listStudentsOfClass: api.listStudentsOfClass }))
vi.mock('@/api/menu', () => ({
  listMenuDays: api.listMenuDays,
  listMenuItemsPlain: api.listMenuItemsPlain,
  areOrdersOpen: api.areOrdersOpen,
}))
vi.mock('@/api/orders', () => ({
  listOrdersPlainOfClass: api.listOrdersPlainOfClass,
  placeOrder: api.placeOrder,
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
  api.listMenuItemsPlain.mockResolvedValue([
    { id: 'mi1', menu_date: today, dish_id: 'd1', dishes: { id: 'd1', name: 'Гречана каша', category: 'second' } },
    { id: 'mi2', menu_date: today, dish_id: 'd2', dishes: { id: 'd2', name: 'Чай', category: 'second' } },
  ])
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
    expect(within(ordered).queryByRole('button')).not.toBeInTheDocument()
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
    api.listMenuItemsPlain.mockResolvedValue([])
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
})
