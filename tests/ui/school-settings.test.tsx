import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

const api = vi.hoisted(() => ({
  getReportSettings: vi.fn(),
  updateDirector: vi.fn(),
  listPrivilegeCategories: vi.fn(),
  createPrivilegeCategory: vi.fn(),
  updatePrivilegeCategory: vi.fn(),
  deletePrivilegeCategory: vi.fn(),
}))

vi.mock('@/api/reportSettings', () => ({
  getReportSettings: api.getReportSettings,
  updateDirector: api.updateDirector,
}))
vi.mock('@/api/privilegeCategories', () => ({
  listPrivilegeCategories: api.listPrivilegeCategories,
  createPrivilegeCategory: api.createPrivilegeCategory,
  updatePrivilegeCategory: api.updatePrivilegeCategory,
  deletePrivilegeCategory: api.deletePrivilegeCategory,
}))

const { default: SchoolSettingsPage } = await import('@/pages/admin/SchoolSettingsPage')

beforeEach(() => {
  vi.clearAllMocks()
  api.getReportSettings.mockResolvedValue({ id: true, director_last_name: '', director_first_name: '' })
  api.updateDirector.mockResolvedValue({})
  api.listPrivilegeCategories.mockResolvedValue([
    { id: 'vpo', name: 'Діти з числа ВПО', is_active: true, created_at: '' },
  ])
  api.createPrivilegeCategory.mockResolvedValue({})
  api.updatePrivilegeCategory.mockResolvedValue({})
})

describe('налаштування школи', () => {
  it('директор: показує, як ім’я виглядатиме в документі, і зберігає', async () => {
    renderWithProviders(<SchoolSettingsPage />, { role: 'admin' })
    await userEvent.type(await screen.findByLabelText('Прізвище'), 'Петренко')
    await userEvent.type(screen.getByLabelText('Ім’я'), 'Олена')

    expect(screen.getByText(/_+ Олена ПЕТРЕНКО/)).toBeInTheDocument()
    await userEvent.click(screen.getAllByRole('button', { name: 'Зберегти' })[0])
    expect(api.updateDirector).toHaveBeenCalledWith('Петренко', 'Олена')
  })

  it('додає пільгову категорію', async () => {
    renderWithProviders(<SchoolSettingsPage />, { role: 'admin' })
    await userEvent.type(await screen.findByLabelText('Нова категорія'), 'Діти з багатодітних сімей')
    await userEvent.click(screen.getByRole('button', { name: 'Додати' }))
    expect(api.createPrivilegeCategory).toHaveBeenCalledWith('Діти з багатодітних сімей')
  })

  it('вимикає категорію замість видалення', async () => {
    renderWithProviders(<SchoolSettingsPage />, { role: 'admin' })
    await userEvent.click(await screen.findByRole('switch', { name: 'Пропонувати «Діти з числа ВПО»' }))
    expect(api.updatePrivilegeCategory).toHaveBeenCalledWith('vpo', { is_active: false })
  })

  it('без міграції каже, що потрібна міграція, а не падає', async () => {
    api.getReportSettings.mockResolvedValue(null)
    renderWithProviders(<SchoolSettingsPage />, { role: 'admin' })
    expect(await screen.findByText(/потрібна міграція бази/)).toBeInTheDocument()
  })
})
