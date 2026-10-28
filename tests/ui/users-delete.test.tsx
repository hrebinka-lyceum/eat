import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

const { listStaff, deleteUser, listClasses } = vi.hoisted(() => ({
  listStaff: vi.fn(),
  deleteUser: vi.fn(),
  listClasses: vi.fn(),
}))

vi.mock('@/api/profiles', () => ({ listStaff, deleteUser, setRole: vi.fn(), setStatus: vi.fn() }))
vi.mock('@/api/classes', () => ({ listClasses }))
vi.mock('@/api/settings', () => ({ getSettings: vi.fn(async () => ({ current_year: '2026/2027' })) }))

const { default: UsersPage } = await import('@/pages/superadmin/UsersPage')

const profile = (id: string, full_name: string, role = 'teacher') => ({
  id,
  full_name,
  role,
  status: 'active',
  must_change_password: false,
  created_at: '',
})

beforeEach(() => {
  vi.clearAllMocks()
  // u1 — це той, хто увійшов (fakeAuth)
  listStaff.mockResolvedValue([profile('u1', 'Головко Наталія', 'superadmin'), profile('t1', 'Савчук Ірина')])
  listClasses.mockResolvedValue([{ id: 'c7', name: '7-А', academic_year: '2026/2027', teacher_id: 't1', total_students: 27 }])
  deleteUser.mockResolvedValue(undefined)
})

describe('видалення акаунта', () => {
  it('власний акаунт видалити не можна', async () => {
    renderWithProviders(<UsersPage />, { role: 'superadmin' })
    expect(await screen.findByRole('button', { name: 'Видалити Головко Наталія' })).toBeDisabled()
  })

  it('попереджає, що клас лишиться без керівника, і видаляє після підтвердження', async () => {
    renderWithProviders(<UsersPage />, { role: 'superadmin' })
    await userEvent.click(await screen.findByRole('button', { name: 'Видалити Савчук Ірина' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/Клас 7-А залишиться без класного керівника/)).toBeInTheDocument()
    expect(deleteUser).not.toHaveBeenCalled()

    // Додаткове попередження: без слова «ВИДАЛИТИ» кнопка не натискається.
    const confirm = within(dialog).getByRole('button', { name: 'Видалити назавжди' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/введіть «ВИДАЛИТИ»/), 'видалити')
    expect(confirm).toBeDisabled()
    await userEvent.clear(within(dialog).getByLabelText(/введіть «ВИДАЛИТИ»/))
    await userEvent.type(within(dialog).getByLabelText(/введіть «ВИДАЛИТИ»/), 'ВИДАЛИТИ')
    await userEvent.click(confirm)
    expect(deleteUser).toHaveBeenCalledWith('t1')
  })
})
