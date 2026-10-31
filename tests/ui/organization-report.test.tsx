import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

const api = vi.hoisted(() => ({
  classCoverage: vi.fn(),
  mealOrders: vi.fn(),
  listClasses: vi.fn(),
  getReportSettings: vi.fn(),
  docxBlob: vi.fn(),
  pdfBlob: vi.fn(),
  downloadBlob: vi.fn(),
}))

vi.mock('@/api/reports', () => ({ mealOrders: api.mealOrders }))
vi.mock('@/api/stats', () => ({ classCoverage: api.classCoverage }))
vi.mock('@/api/classes', () => ({ listClasses: api.listClasses }))
vi.mock('@/api/settings', () => ({ getSettings: vi.fn(async () => ({ current_year: '2026/2027' })) }))
vi.mock('@/api/privilegeCategories', () => ({
  listPrivilegeCategories: vi.fn(async () => [{ id: 'vpo', name: 'Діти з числа ВПО', is_active: true, created_at: '' }]),
}))
vi.mock('@/api/reportSettings', () => ({ getReportSettings: api.getReportSettings }))
// Справжні docx і pdfmake тут ні до чого — їх перевіряють окремі тести.
vi.mock('@/lib/reportDocx', () => ({ docxBlob: api.docxBlob }))
vi.mock('@/lib/reportPdf', () => ({ pdfBlob: api.pdfBlob }))
vi.mock('@/lib/csv', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/csv')>()),
  downloadBlob: api.downloadBlob,
}))

const { default: OrganizationReport } = await import('@/pages/admin/reports/OrganizationReport')

const order = (student: string, klass: string, privileged = false) => ({
  menu_date: '2026-10-01',
  student_id: student,
  class_id: klass,
  privileged,
  cost: 58.4,
  unpriced: false,
  gender: 'female' as const,
  category_ids: privileged ? ['vpo'] : [],
})

beforeEach(() => {
  vi.clearAllMocks()
  api.listClasses.mockResolvedValue([
    { id: 'c1', name: '1-А', academic_year: '2026/2027', teacher_id: null, total_students: 20 },
    { id: 'c7', name: '7-А', academic_year: '2026/2027', teacher_id: null, total_students: 25 },
  ])
  api.mealOrders.mockResolvedValue([order('a', 'c1'), order('b', 'c7', true)])
  // Учнів у класі — зі списку класу: найбільше за період число.
  api.classCoverage.mockResolvedValue([
    { menu_date: '2026-10-01', class_id: 'c1', class_name: '1-А', total_students: null,
      students_registered: 24, students_ordered: 1, coverage_registered_pct: null, coverage_class_pct: null },
    { menu_date: '2026-10-02', class_id: 'c1', class_name: '1-А', total_students: null,
      students_registered: 25, students_ordered: 0, coverage_registered_pct: null, coverage_class_pct: null },
  ])
  api.getReportSettings.mockResolvedValue({ id: true, director_last_name: 'Петренко', director_first_name: 'Олена' })
  api.docxBlob.mockResolvedValue(new Blob(['docx']))
  api.pdfBlob.mockResolvedValue(new Blob(['pdf']))
})

describe('звіт про організацію харчування', () => {
  it('показує на екрані те, що буде в документі', async () => {
    renderWithProviders(<OrganizationReport />, { role: 'admin' })

    expect(await screen.findByText(/_+ Олена ПЕТРЕНКО/)).toBeInTheDocument()
    expect(screen.getByText('ЗВІТ ПРО ОРГАНІЗАЦІЮ ХАРЧУВАННЯ УЧНІВ')).toBeInTheDocument()
    expect(screen.getByText('3. Відвідування')).toBeInTheDocument()
    expect(screen.getByText('Діти з числа ВПО')).toBeInTheDocument()
  })

  it('DOCX формується з тієї самої моделі й завантажується файлом', async () => {
    renderWithProviders(<OrganizationReport />, { role: 'admin' })
    await screen.findByText(/Олена ПЕТРЕНКО/)

    await userEvent.click(screen.getByRole('button', { name: /Завантажити DOCX/ }))

    expect(api.docxBlob).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'ЗВІТ ПРО ОРГАНІЗАЦІЮ ХАРЧУВАННЯ УЧНІВ' }),
    )
    expect(api.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.docx$/))
  })

  it('PDF — так само', async () => {
    renderWithProviders(<OrganizationReport />, { role: 'admin' })
    await screen.findByText(/Олена ПЕТРЕНКО/)

    await userEvent.click(screen.getByRole('button', { name: /Завантажити PDF/ }))

    expect(api.pdfBlob).toHaveBeenCalled()
    expect(api.downloadBlob).toHaveBeenCalledWith(expect.any(Blob), expect.stringMatching(/\.pdf$/))
  })

  it('без імені директора попереджає й веде в налаштування', async () => {
    api.getReportSettings.mockResolvedValue({ id: true, director_last_name: '', director_first_name: '' })
    renderWithProviders(<OrganizationReport />, { role: 'admin' })

    expect(await screen.findByText('Ім’я директора не вказано')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'налаштуваннях школи' })).toHaveAttribute('href', '/school-settings')
  })

  it('порожній період — завантажувати нічого', async () => {
    api.mealOrders.mockResolvedValue([])
    renderWithProviders(<OrganizationReport />, { role: 'admin' })

    expect(await screen.findByText('За цей період замовлень немає')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Завантажити DOCX/ })).toBeDisabled()
  })

  // Список класу — усі учні, тож «учнів у класі» береться з нього, а не з
  // поля, яке колись вписувала адміністрація (у 1-А там 20).
  it('учнів у класі — за списком класу', async () => {
    renderWithProviders(<OrganizationReport />, { role: 'admin' })
    await screen.findByText('3. Відвідування')

    const row = screen.getAllByRole('cell', { name: '1-А' })[0].closest('tr') as HTMLElement
    const cells = within(row).getAllByRole('cell').map((cell) => cell.textContent)
    // Клас · Учнів у класі · Харчувалися · З них пільговиків · Охоплення
    expect(cells).toEqual(['1-А', '25', '1', '0', '4,0'])
  })
})
