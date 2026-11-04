import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

/**
 * Адміністрація додає учнів у класи — зокрема в класи без керівника, куди
 * інакше учня не внести взагалі.
 */
const api = vi.hoisted(() => ({
  listClasses: vi.fn(),
  createStudent: vi.fn(),
  searchStudents: vi.fn(),
}))

vi.mock('@/api/settings', () => ({ getSettings: vi.fn(async () => ({ current_year: '2026/2027' })) }))
vi.mock('@/api/classes', () => ({
  listClasses: api.listClasses,
  createClass: vi.fn(),
  deleteClass: vi.fn(),
  setClassTeacher: vi.fn(),
}))
vi.mock('@/api/profiles', () => ({ listStaff: vi.fn(async () => []) }))
vi.mock('@/api/privilegeCategories', () => ({ listPrivilegeCategories: vi.fn(async () => []) }))
vi.mock('@/api/students', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/students')>()),
  countStudentsByClass: vi.fn(async () => new Map()),
  createStudent: api.createStudent,
  searchStudents: api.searchStudents,
}))

const { default: ClassesPage } = await import('@/pages/admin/ClassesPage')
const { default: StudentSearchPage } = await import('@/pages/admin/StudentSearchPage')

const classes = [
  { id: 'c1', name: '1-А', academic_year: '2026/2027', teacher_id: null, total_students: null },
  { id: 'c7', name: '7-Б', academic_year: '2026/2027', teacher_id: null, total_students: null },
]

beforeEach(() => {
  vi.clearAllMocks()
  api.listClasses.mockResolvedValue(classes)
  api.searchStudents.mockResolvedValue([])
  api.createStudent.mockResolvedValue({ last_name: 'Мороз', first_name: 'Злата' })
})

async function fillStudent() {
  await userEvent.type(screen.getByLabelText('Прізвище'), 'Мороз')
  await userEvent.type(screen.getByLabelText('Ім’я'), 'Злата')
  await userEvent.click(screen.getByLabelText('Стать'))
  await userEvent.click(await screen.findByRole('option', { name: 'Жіноча' }))
}

describe('адміністратор додає учня', () => {
  it('з рядка класу на «Класах» — саме до цього класу, навіть без керівника', async () => {
    renderWithProviders(<ClassesPage />, { role: 'admin' })

    await userEvent.click(await screen.findByRole('button', { name: 'Додати учня до 7-Б' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Додати учня до 7-Б' })).toBeInTheDocument()
    // Клас уже обрано рядком — питати його вдруге не треба.
    expect(within(dialog).queryByLabelText('Клас')).not.toBeInTheDocument()

    await fillStudent()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Додати' }))

    expect(api.createStudent).toHaveBeenCalledWith(
      expect.objectContaining({ class_id: 'c7', last_name: 'Мороз', first_name: 'Злата', gender: 'female' }),
    )
  })

  it('з пошуку — лише після вибору класу', async () => {
    renderWithProviders(<StudentSearchPage />, { role: 'admin' })

    await userEvent.click(screen.getByRole('button', { name: 'Додати учня' }))
    const dialog = await screen.findByRole('dialog')
    await fillStudent()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Додати' }))

    expect(await within(dialog).findByText('Оберіть клас.')).toBeInTheDocument()
    expect(api.createStudent).not.toHaveBeenCalled()

    await userEvent.click(within(dialog).getByLabelText('Клас'))
    await userEvent.click(await screen.findByRole('option', { name: '1-А' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Додати' }))

    expect(api.createStudent).toHaveBeenCalledWith(expect.objectContaining({ class_id: 'c1' }))
  })
})
