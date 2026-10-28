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
  privilege_category_ids: [],
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
    { id: 'big', name: 'Багатодітна родина', is_active: true, created_at: '' },
    { id: 'vpo', name: 'Діти з числа ВПО', is_active: true, created_at: '' },
    { id: 'old', name: 'Стара категорія', is_active: false, created_at: '' },
  ])
})

function form(over: Partial<Student> = {}) {
  return renderWithProviders(<StudentProfileForm student={student(over)} idPrefix="t" unknownAuthor="—" />, {
    role: 'teacher',
  })
}

async function openCategories() {
  await userEvent.click(screen.getByLabelText('Пільгові категорії'))
  return screen.findByRole('menu')
}

const chips = () => screen.queryByRole('list', { name: 'Обрані пільгові категорії' })

describe('профіль учня', () => {
  it('зберігає ім’я, стать і категорії одним записом', async () => {
    form()

    const last = screen.getByLabelText('Прізвище')
    await userEvent.clear(last)
    await userEvent.type(last, 'Бойко-Ткач')
    await userEvent.click(screen.getByLabelText('Стать'))
    await userEvent.click(await screen.findByRole('option', { name: 'Жіноча' }))
    await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))

    expect(updateStudentProfile).toHaveBeenCalledWith('s1', {
      lastName: 'Бойко-Ткач',
      firstName: 'Анна',
      gender: 'female',
      privilege: { categoryIds: [], uncategorized: false },
    })
  })

  // Дитина буває одночасно з багатодітної родини і ВПО — список не
  // закривається після вибору, обидві видно «чипами».
  it('дає обрати кілька категорій і показує їх під списком', async () => {
    form()

    const menu = await openCategories()
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Діти з числа ВПО' }))
    await userEvent.click(within(menu).getByRole('menuitemcheckbox', { name: 'Багатодітна родина' }))
    await userEvent.keyboard('{Escape}')

    const selected = within(chips()!)
    expect(selected.getByText('Діти з числа ВПО')).toBeInTheDocument()
    expect(selected.getByText('Багатодітна родина')).toBeInTheDocument()
    expect(screen.getByLabelText('Пільгові категорії')).toHaveTextContent('Обрано: 2')
    // У звітах рахується перша обрана — про це треба сказати прямо.
    expect(screen.getByText(/за першою категорією — «Діти з числа ВПО»/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(updateStudentProfile).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ privilege: { categoryIds: ['vpo', 'big'], uncategorized: false } }),
    )
  })

  it('обрану категорію можна прибрати хрестиком', async () => {
    form({ is_privileged: true, privilege_category_ids: ['vpo', 'big'] })

    await userEvent.click(await screen.findByRole('button', { name: 'Прибрати «Діти з числа ВПО»' }))
    expect(within(chips()!).queryByText('Діти з числа ВПО')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(updateStudentProfile).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ privilege: { categoryIds: ['big'], uncategorized: false } }),
    )
  })

  it('прибрали всі категорії — пільги немає', async () => {
    form({ is_privileged: true, privilege_category_ids: ['vpo'] })

    await userEvent.click(await screen.findByRole('button', { name: 'Прибрати «Діти з числа ВПО»' }))
    expect(chips()).not.toBeInTheDocument()
    expect(screen.getByLabelText('Пільгові категорії')).toHaveTextContent('Без пільги')
  })

  it('вимкнену категорію пропонує лише тому, в кого вона вже стоїть', async () => {
    form()
    const menu = await openCategories()
    expect(within(menu).queryByText(/Стара категорія/)).not.toBeInTheDocument()
  })

  it('стоїть вимкнена категорія — її видно', async () => {
    form({ is_privileged: true, privilege_category_ids: ['old'] })
    expect(await within(await screen.findByRole('list', { name: 'Обрані пільгові категорії' })).findByText('Стара категорія')).toBeInTheDocument()
    const menu = await openCategories()
    expect(within(menu).getByRole('menuitemcheckbox', { name: 'Стара категорія (вимкнена)' })).toBeInTheDocument()
  })

  it('пільга, поставлена до появи категорій, не губиться', async () => {
    form({ is_privileged: true })
    expect(within(chips()!).getByText('Пільга без категорії')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(updateStudentProfile).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ privilege: { categoryIds: [], uncategorized: true } }),
    )
  })

  it('порожнє прізвище не зберігає', async () => {
    form()
    await userEvent.clear(screen.getByLabelText('Прізвище'))
    await userEvent.click(screen.getByRole('button', { name: 'Зберегти' }))
    expect(await screen.findByText(/не можуть бути порожніми/)).toBeInTheDocument()
    expect(updateStudentProfile).not.toHaveBeenCalled()
  })
})
