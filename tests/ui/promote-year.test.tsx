import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

const { promoteAcademicYear, listClasses, getSettings } = vi.hoisted(() => ({
  promoteAcademicYear: vi.fn(),
  listClasses: vi.fn(),
  getSettings: vi.fn(),
}))

vi.mock('@/api/admin', () => ({ promoteAcademicYear }))
vi.mock('@/api/classes', () => ({ listClasses }))
vi.mock('@/api/settings', () => ({ getSettings }))

const { default: PromoteYearPage } = await import('@/pages/superadmin/PromoteYearPage')

const klass = (name: string) => ({
  id: name,
  name,
  academic_year: '2026/2027',
  teacher_id: null,
  total_students: null,
})

beforeEach(() => {
  vi.clearAllMocks()
  getSettings.mockResolvedValue({ current_year: '2026/2027' })
  listClasses.mockResolvedValue([klass('1-А'), klass('4-А'), klass('5-А'), klass('11-А')])
  promoteAcademicYear.mockResolvedValue({
    previous_year: '2026/2027',
    new_year: '2027/2028',
    start_date: '2027-09-01',
    classes_created: 4,
    entry_classes: 1,
    students_moved: 10,
    students_graduated: 2,
  })
})

async function confirmAndPromote() {
  await userEvent.type(screen.getByLabelText('Введіть 2027/2028'), '2027/2028')
  await userEvent.click(screen.getByRole('button', { name: /Перевести рік/ }))
}

describe('переведення навчального року', () => {
  // Головне: типові значення функції в базі — 5 і 11. Для школи з 1-ми
  // класами вони створили б другий комплект п'ятих поверх переведених
  // четвертих і впали б на unique(name, academic_year).
  it('передає межі паралелей, узяті з наявних класів', async () => {
    renderWithProviders(<PromoteYearPage />, { role: 'superadmin' })
    await screen.findByText(/паралелі з 1 по 11/)

    await confirmAndPromote()

    expect(promoteAcademicYear).toHaveBeenCalledWith('2027/2028', {
      startDate: undefined,
      minGrade: 1,
      maxGrade: 11,
    })
  })

  it('для школи 5–11 передає 5 і 11', async () => {
    listClasses.mockResolvedValue([klass('5-А'), klass('9-Б'), klass('11-А')])

    renderWithProviders(<PromoteYearPage />, { role: 'superadmin' })
    await screen.findByText(/паралелі з 5 по 11/)

    await confirmAndPromote()

    expect(promoteAcademicYear).toHaveBeenCalledWith('2027/2028', {
      startDate: undefined,
      minGrade: 5,
      maxGrade: 11,
    })
  })

  it('пояснення говорить про наявні паралелі, а не про п’яті й одинадцяті', async () => {
    renderWithProviders(<PromoteYearPage />, { role: 'superadmin' })
    await screen.findByText(/паралелі з 1 по 11/)

    expect(screen.getByText(/1-А стане 2-А/)).toBeInTheDocument()
    expect(screen.getByText(/Класи 11 паралелі/)).toBeInTheDocument()
  })

  it('межі можна виправити вручну', async () => {
    renderWithProviders(<PromoteYearPage />, { role: 'superadmin' })
    await screen.findByText(/паралелі з 1 по 11/)

    await userEvent.type(screen.getByLabelText('Наймолодша паралель'), '2')
    await confirmAndPromote()

    expect(promoteAcademicYear).toHaveBeenCalledWith('2027/2028', {
      startDate: undefined,
      minGrade: 2,
      maxGrade: 11,
    })
  })

  // Клас без числа на початку назви база розібрати не зможе і впаде на
  // приведенні типу — краще не давати запустити переведення взагалі.
  it('назву класу без паралелі показує і блокує кнопку', async () => {
    listClasses.mockResolvedValue([klass('1-А'), klass('Підготовчий'), klass('11-А')])

    renderWithProviders(<PromoteYearPage />, { role: 'superadmin' })
    await screen.findByText(/Не всі назви класів розбираються/)

    expect(screen.getByText(/Підготовчий/)).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Введіть 2027/2028'), '2027/2028')
    expect(screen.getByRole('button', { name: /Перевести рік/ })).toBeDisabled()
    expect(promoteAcademicYear).not.toHaveBeenCalled()
  })

  it('випускна паралель, не більша за наймолодшу, зупиняє переведення', async () => {
    renderWithProviders(<PromoteYearPage />, { role: 'superadmin' })
    await screen.findByText(/паралелі з 1 по 11/)

    await userEvent.clear(screen.getByLabelText('Випускна паралель'))
    await userEvent.type(screen.getByLabelText('Випускна паралель'), '1')
    await userEvent.type(screen.getByLabelText('Введіть 2027/2028'), '2027/2028')

    expect(screen.getByText(/випускна має бути більшою/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Перевести рік/ })).toBeDisabled()
  })
})
