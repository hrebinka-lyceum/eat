import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { renderWithProviders } from '../helpers'

/**
 * Список класу — усі учні, і ті, хто не харчується. Розмір класу ніхто не
 * вписує окремо: це кількість учнів у списку, а охоплення — частка класу.
 */
const api = vi.hoisted(() => ({
  getClassOfTeacher: vi.fn(),
  listClasses: vi.fn(),
  listStaff: vi.fn(),
  countStudentsByClass: vi.fn(),
  listStudentsOfClass: vi.fn(),
  classCoverage: vi.fn(),
}))

vi.mock('@/api/settings', () => ({ getSettings: vi.fn(async () => ({ current_year: '2026/2027' })) }))
vi.mock('@/api/classes', () => ({
  getClassOfTeacher: api.getClassOfTeacher,
  listClasses: api.listClasses,
  createClass: vi.fn(),
  deleteClass: vi.fn(),
  setClassTeacher: vi.fn(),
}))
vi.mock('@/api/profiles', () => ({ listStaff: api.listStaff }))
vi.mock('@/api/students', () => ({
  countStudentsByClass: api.countStudentsByClass,
  listStudentsOfClass: api.listStudentsOfClass,
}))
vi.mock('@/api/stats', () => ({ classCoverage: api.classCoverage }))

const { default: ClassesPage } = await import('@/pages/admin/ClassesPage')
const { default: ClassDashboardPage } = await import('@/pages/teacher/ClassDashboardPage')

const klass = { id: 'c7', name: '7-А', academic_year: '2026/2027', teacher_id: 'u1', total_students: 99 }

beforeEach(() => {
  vi.clearAllMocks()
  api.listClasses.mockResolvedValue([klass])
  api.listStaff.mockResolvedValue([])
  api.countStudentsByClass.mockResolvedValue(new Map([['c7', 27]]))
  api.getClassOfTeacher.mockResolvedValue(klass)
  api.listStudentsOfClass.mockResolvedValue(Array.from({ length: 27 }, (_, i) => ({ id: `s${i}` })))
})

describe('розмір класу — за списком', () => {
  // Поле, яке колись вписувала адміністрація (тут 99), більше ні на що не
  // впливає: число береться зі списку класу.
  it('«Класи» показують кількість учнів зі списку, без поля для введення', async () => {
    renderWithProviders(<ClassesPage />, { role: 'admin' })

    const row = (await screen.findByRole('cell', { name: '7-А' })).closest('tr') as HTMLElement
    expect(await within(row).findByText('27')).toBeInTheDocument()
    expect(within(row).queryByText('99')).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument()
  })
})

describe('дашборд класу', () => {
  // Пастка: середнє денних відсотків дає дню з одним учнем у списку вагу
  // повного дня. Рахуємо від сум за період.
  it('«У середньому за період» — від сум, а не середнє денних відсотків', async () => {
    const day = (menu_date: string, inClass: number, ordered: number) => ({
      menu_date, class_id: 'c7', class_name: '7-А', total_students: null,
      students_registered: inClass, students_ordered: ordered,
      coverage_registered_pct: (ordered / inClass) * 100, coverage_class_pct: null,
    })
    api.classCoverage.mockResolvedValue([day('2026-10-01', 1, 1), day('2026-10-02', 99, 49)])

    renderWithProviders(<ClassDashboardPage />, { role: 'teacher' })

    const tile = (await screen.findByText('У середньому за період')).closest('div') as HTMLElement
    // 50 / 100 = 50%, а не (100 + 49,5) / 2 = 74,75%
    expect(await within(tile).findByText('50%')).toBeInTheDocument()
    const size = screen.getAllByText('Учнів у класі')[0].closest('div') as HTMLElement
    expect(within(size).getByText('27')).toBeInTheDocument()
  })
})
