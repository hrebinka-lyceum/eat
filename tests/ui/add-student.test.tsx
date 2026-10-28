import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

const { createStudent, listPrivilegeCategories } = vi.hoisted(() => ({
  createStudent: vi.fn(),
  listPrivilegeCategories: vi.fn(),
}))

vi.mock('@/api/students', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/students')>()),
  createStudent,
}))
vi.mock('@/api/privilegeCategories', () => ({ listPrivilegeCategories }))

const { AddStudentDialog } = await import('@/pages/teacher/components/AddStudentDialog')

beforeEach(() => {
  vi.clearAllMocks()
  createStudent.mockResolvedValue({ last_name: 'Мороз', first_name: 'Злата' })
  listPrivilegeCategories.mockResolvedValue([
    { id: 'vpo', name: 'Діти з числа ВПО', is_active: true, created_at: '' },
  ])
})

async function fillName() {
  await userEvent.type(screen.getByLabelText('Прізвище'), 'Мороз')
  await userEvent.type(screen.getByLabelText('Ім’я'), 'Злата')
}

describe('додавання учня', () => {
  // Без статі дитина випадає зі звітів за статтю — тож без неї не додаємо.
  it('без статі не додає', async () => {
    renderWithProviders(<AddStudentDialog open onOpenChange={() => {}} classId="c1" />, { role: 'teacher' })
    await fillName()
    await userEvent.click(screen.getByRole('button', { name: 'Додати' }))

    expect(await screen.findByText('Вкажіть стать.')).toBeInTheDocument()
    expect(createStudent).not.toHaveBeenCalled()
  })

  it('пише стать і пільгові категорії разом із карткою', async () => {
    renderWithProviders(<AddStudentDialog open onOpenChange={() => {}} classId="c1" />, { role: 'teacher' })
    await fillName()
    await userEvent.click(screen.getByLabelText('Стать'))
    await userEvent.click(await screen.findByRole('option', { name: 'Жіноча' }))
    await userEvent.click(screen.getByLabelText('Пільгові категорії'))
    await userEvent.click(await screen.findByRole('menuitemcheckbox', { name: 'Діти з числа ВПО' }))
    await userEvent.keyboard('{Escape}')
    await userEvent.click(screen.getByRole('button', { name: 'Додати' }))

    expect(createStudent).toHaveBeenCalledWith(
      expect.objectContaining({
        class_id: 'c1',
        last_name: 'Мороз',
        first_name: 'Злата',
        gender: 'female',
        is_privileged: true,
        privilege_category_ids: ['vpo'],
      }),
    )
  })
})
