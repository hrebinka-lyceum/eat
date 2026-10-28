import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'
import type { Student } from '@/types/database'

const { updateStudentProfile, getPrivilegeLog, listPrivilegeCategories } = vi.hoisted(() => ({
  updateStudentProfile: vi.fn(),
  getPrivilegeLog: vi.fn(),
  listPrivilegeCategories: vi.fn(),
}))

vi.mock('@/api/students', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/students')>()),
  updateStudentProfile,
  getPrivilegeLog,
}))
vi.mock('@/api/privilegeCategories', () => ({ listPrivilegeCategories }))

const { StudentProfileForm } = await import('@/components/students/StudentProfileForm')

const student = (over: Partial<Student> = {}): Student => ({
  id: 's1',
  class_id: 'c1',
  last_name: 'Бойко',
  first_name: 'Анна',
  profile_id: null,
  is_privileged: false,
  privilege_note: null,
  privilege_category_id: null,
  gender: null,
  is_active: true,
  enrolled_from: '2026-09-01',
  left_at: null,
  created_at: '2026-09-01T00:00:00Z',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  getPrivilegeLog.mockResolvedValue([])
  updateStudentProfile.mockResolvedValue(student())
  listPrivilegeCategories.mockResolvedValue([
    { id: 'vpo', name: 'Діти з числа ВПО', is_active: true, created_at: '' },
    { id: 'old', name: 'Стара категорія', is_active: false, created_at: '' },
  ])
})

async function choose(label: string, option: string) {
  await userEvent.click(screen.getByLabelText(label))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('профіль учня', () => {
  it('зберігає ім’я, стать і категорію одним записом', async () => {
    renderWithProviders(<StudentProfileForm student={student()} idPrefix="t" unknownAuthor="—" />, {
      role: 'teacher',
    })

    const last = screen.getByLabelText('Прізвище')
    await userEvent.clear(last)
    await userEvent.type(last, 'Бойко-Ткач')
    await choose('Стать', 'Жіноча')
    await choose('Пільгова категорія', 'Діти з числа ВПО')
    await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(updateStudentProfile).toHaveBeenCalledWith('s1', {
      lastName: 'Бойко-Ткач',
      firstName: 'Анна',
      gender: 'female',
      privilege: { kind: 'category', categoryId: 'vpo' },
    })
  })

  // Вимкнена категорія не пропонується новим учням, але в того, кому вона вже
  // стоїть, поле не може показувати порожнечу.
  it('вимкнену категорію пропонує лише тому, в кого вона вже стоїть', async () => {
    renderWithProviders(<StudentProfileForm student={student()} idPrefix="t" unknownAuthor="—" />)
    await userEvent.click(screen.getByLabelText('Пільгова категорія'))
    const list = await screen.findByRole('listbox')
    expect(within(list).queryByText(/Стара категорія/)).not.toBeInTheDocument()
  })

  it('стоїть вимкнена категорія — її видно з позначкою', async () => {
    renderWithProviders(
      <StudentProfileForm
        student={student({ is_privileged: true, privilege_category_id: 'old' })}
        idPrefix="t"
        unknownAuthor="—"
      />,
    )
    expect(await screen.findByText('Стара категорія (вимкнена)')).toBeInTheDocument()
  })

  it('пільга, поставлена до появи категорій, не губиться', async () => {
    renderWithProviders(
      <StudentProfileForm student={student({ is_privileged: true })} idPrefix="t" unknownAuthor="—" />,
    )
    expect(await screen.findByText('Пільга без категорії')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(updateStudentProfile).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ privilege: { kind: 'uncategorized' } }),
    )
  })

  it('порожнє прізвище не зберігає', async () => {
    renderWithProviders(<StudentProfileForm student={student()} idPrefix="t" unknownAuthor="—" />)
    await userEvent.clear(screen.getByLabelText('Прізвище'))
    await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(await screen.findByText(/не можуть бути порожніми/)).toBeInTheDocument()
    expect(updateStudentProfile).not.toHaveBeenCalled()
  })
})
