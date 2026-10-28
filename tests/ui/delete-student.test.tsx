import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'
import type { Student } from '@/types/database'

const { studentOrderSummary, deleteStudent } = vi.hoisted(() => ({
  studentOrderSummary: vi.fn(),
  deleteStudent: vi.fn(),
}))

vi.mock('@/api/students', () => ({ studentOrderSummary, deleteStudent }))

const { DeleteStudentDialog } = await import('@/pages/admin/components/DeleteStudentDialog')

const student: Student = {
  id: 's1',
  class_id: 'c1',
  last_name: 'Бойко',
  first_name: 'Анна',
  profile_id: 'p1',
  is_privileged: false,
  privilege_note: null,
  privilege_category_id: null,
  gender: 'female',
  is_active: true,
  enrolled_from: '2026-09-01',
  left_at: null,
  created_at: '',
}

function renderAs(role: 'admin' | 'superadmin') {
  return renderWithProviders(
    <DeleteStudentDialog student={student} open onOpenChange={() => {}} onDeleted={() => {}} />,
    { role },
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  deleteStudent.mockResolvedValue({ accountNote: null })
})

describe('видалення учня', () => {
  it('без замовлень — звичайне підтвердження, без примусу', async () => {
    studentOrderSummary.mockResolvedValue({ count: 0, first: null, last: null })
    renderAs('admin')

    await screen.findByText(/жодного разу не харчувався/)
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Видалити' }))
    expect(deleteStudent).toHaveBeenCalledWith('s1', { force: false })
  })

  // Адміністратор історію не стирає: лише суперадмін.
  it('адміністратору з історією видалити не дає і підказує вихід', async () => {
    studentOrderSummary.mockResolvedValue({ count: 12, first: '2026-09-01', last: '2026-10-27' })
    renderAs('admin')

    await screen.findByText(/12 замовлень/)
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/лише\s+суперадміністратор/)).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: /Видалити/ })).not.toBeInTheDocument()
  })

  it('суперадміну — окреме попередження і підтвердження словом', async () => {
    studentOrderSummary.mockResolvedValue({ count: 12, first: '2026-09-01', last: '2026-10-27' })
    renderAs('superadmin')

    await screen.findByText('Разом з учнем зникне вся його історія')
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Звіти за ці місяці зміняться заднім числом/)).toBeInTheDocument()

    const confirm = within(dialog).getByRole('button', { name: 'Видалити назавжди' })
    expect(confirm).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText(/введіть «ВИДАЛИТИ»/), 'ВИДАЛИТИ')
    await userEvent.click(confirm)

    expect(deleteStudent).toHaveBeenCalledWith('s1', { force: true })
  })
})
