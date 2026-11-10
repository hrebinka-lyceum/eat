import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

const {
  getNextEmptyDay, getMenuDay, listMenuItems, listDishes, addMenuItem, setDayPrice, findOrCreateComponent,
  listSpecialMenus, saveSpecialMenu, listClasses,
} = vi.hoisted(() => ({
  getNextEmptyDay: vi.fn(),
  getMenuDay: vi.fn(),
  listMenuItems: vi.fn(),
  listDishes: vi.fn(),
  addMenuItem: vi.fn(),
  setDayPrice: vi.fn(),
  findOrCreateComponent: vi.fn(),
  listSpecialMenus: vi.fn(),
  saveSpecialMenu: vi.fn(),
  listClasses: vi.fn(),
}))

vi.mock('@/api/menu', () => ({
  getNextEmptyDay,
  getMenuDay,
  listMenuItems,
  addMenuItem,
  setDayPrice,
  removeMenuItem: vi.fn(),
  setMenuItemPrice: vi.fn(),
  createMenuDay: vi.fn(),
  setMenuDayStatus: vi.fn(),
  generateMenuDays: vi.fn(),
  copyMenu: vi.fn(),
}))
vi.mock('@/api/specialMenus', () => ({ listSpecialMenus, saveSpecialMenu, deleteSpecialMenu: vi.fn() }))
vi.mock('@/api/settings', () => ({ getSettings: vi.fn(async () => ({ current_year: '2026/2027' })) }))
vi.mock('@/api/classes', () => ({ listClasses }))
vi.mock('@/api/dishes', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/dishes')>()),
  listDishes,
  findOrCreateComponent,
}))

const { default: MenuEditorPage } = await import('@/pages/cafeteria/MenuEditorPage')

const DATE = '2026-09-01'
const day = {
  menu_date: DATE, status: 'draft' as const,
  cutoff_at: '2026-09-30T05:00:00Z', created_at: DATE,
}
const menuItem = (id: string, name: string, category: string, special: string | null = null) => ({
  id, menu_date: DATE, dish_id: `d${id}`, price: 24.5, special_menu_id: special,
  dishes: { id: `d${id}`, name, category, is_active: true },
})
const klass = (id: string, name: string) => ({
  id, name, academic_year: '2026/2027', teacher_id: null, total_students: null,
})
const specialMenu = (id: string, name: string, classes: Array<{ id: string; name: string }>) => ({
  id, menu_date: DATE, name, created_at: '', classes,
})

beforeEach(() => {
  // Стан «днів меню ще немає» — саме на ньому екран колись падав.
  getNextEmptyDay.mockResolvedValue(null)
  getMenuDay.mockResolvedValue(null)
  listMenuItems.mockResolvedValue([])
  listDishes.mockResolvedValue([])
  listSpecialMenus.mockResolvedValue([])
  listClasses.mockResolvedValue([klass('c1', '1-А'), klass('c2', '1-Б'), klass('c7', '7-А')])
  saveSpecialMenu.mockReset()
  addMenuItem.mockReset()
  setDayPrice.mockReset()
})

describe('редактор меню', () => {
  it('показує одне поле вартості на все блюдо, а не ціну кожного компонента', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      { ...menuItem('mi1', 'Гречана каша', 'second'), price: 62.5 },
      { ...menuItem('mi2', 'Котлета', 'second'), price: null },
      { ...menuItem('mi3', 'Чай', 'drink'), price: null },
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Гречана каша')

    // Одне поле на все блюдо; сума лежить на одному компоненті, але кухар
    // бачить її як вартість блюда.
    const price = screen.getByLabelText('Вартість блюда') as HTMLInputElement
    expect(price.value).toBe('62.5')
    expect(screen.getByText('Компонентів: 3')).toBeInTheDocument()
  })

  it('без указаної вартості попереджає, що день додасть нуль', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      { ...menuItem('mi1', 'Гречана каша', 'second'), price: null },
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })

    expect(await screen.findByText(/Вартість блюда ще не вказана/)).toBeInTheDocument()
  })

  // Склад блюда — справа їдальні: будь-які компоненти в будь-якій кількості.
  it('дозволяє скласти блюдо з довільних компонентів', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      menuItem('mi1', 'Гречана каша', 'second'),
      menuItem('mi2', 'Котлета', 'second'),
      menuItem('mi3', 'Чай', 'drink'),
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Гречана каша')

    expect(screen.getByText('Котлета')).toBeInTheDocument()
    expect(screen.getByText('Чай')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Опублікувати/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('порожнє блюдо опублікувати не можна', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Блюдо на цей день ще не складено')

    await userEvent.click(screen.getByRole('button', { name: /Опублікувати/ }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('складене блюдо публікується без перешкод', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([
      menuItem('mi1', 'Каша вівсяна', 'second'),
      menuItem('mi2', 'Чай з цукром', 'drink'),
    ])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Каша вівсяна')

    expect(screen.getByText('Чай з цукром')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Опублікувати/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  // Регресія: пропси закритого ConfirmDialog обчислювалися завжди, і
  // formatCutoff('') кидав RangeError — увесь екран лишався порожнім.
  it('коли дня меню ще немає, показує картку створення, а не білий екран', async () => {
    const { container } = renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })

    expect(await screen.findByText(/ще не створено/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Створити день' })).toBeInTheDocument()
    expect(container.textContent).toContain('Редактор меню')
  })

  // Новий компонент: спершу в довідник, потім у блюдо, потім — вартість
  // заново (тригер ставить новій позиції ціну з довідника).
  it('новий компонент додає і в довідник, і в блюдо, зберігаючи вартість', async () => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
    listMenuItems.mockResolvedValue([{ ...menuItem('mi1', 'Гречана каша', 'second'), price: 58.5 }])
    findOrCreateComponent.mockResolvedValue({ id: 'new', name: 'Перець свіжий', category: 'second', price: null, is_active: true })
    addMenuItem.mockResolvedValue({})
    setDayPrice.mockResolvedValue(undefined)

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Гречана каша')
    await userEvent.type(screen.getByLabelText('Пошук компонента'), 'перець свіжий')
    await userEvent.click(screen.getByRole('button', { name: 'Додати «Перець свіжий» як новий компонент' }))

    await vi.waitFor(() => expect(setDayPrice).toHaveBeenCalled())
    expect(findOrCreateComponent).toHaveBeenCalledWith('Перець свіжий')
    expect(addMenuItem).toHaveBeenCalledWith(DATE, 'new', null)
    expect(setDayPrice).toHaveBeenCalledWith(DATE, 58.5, null)
    expect(addMenuItem.mock.invocationCallOrder[0]).toBeLessThan(setDayPrice.mock.invocationCallOrder[0])
  })

  it('без дня публікувати нічого — кнопка неактивна', async () => {
    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    expect(await screen.findByRole('button', { name: /Опублікувати/ })).toBeDisabled()
  })
})

describe('спеціальні меню в редакторі', () => {
  beforeEach(() => {
    getNextEmptyDay.mockResolvedValue(day)
    getMenuDay.mockResolvedValue(day)
  })

  // Кожне меню — свій склад і своя вартість. Компонент, доданий у відкритому
  // спецменю, має потрапити саме туди, а вартість — лягти на його компонент.
  it('у спецменю видно лише його склад і вартість, і компоненти йдуть у нього', async () => {
    listSpecialMenus.mockResolvedValue([specialMenu('sm1', 'Дієтичне', [{ id: 'c1', name: '1-А' }])])
    listMenuItems.mockResolvedValue([
      { ...menuItem('mi1', 'Гречана каша', 'second'), price: 50 },
      { ...menuItem('ms1', 'Рисова каша на воді', 'second', 'sm1'), price: 65 },
    ])
    listDishes.mockResolvedValue([
      { id: 'dk', name: 'Компот', category: 'second', price: null, is_active: true },
    ])
    addMenuItem.mockResolvedValue({})
    setDayPrice.mockResolvedValue(undefined)

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Гречана каша')
    expect((screen.getByLabelText('Вартість блюда') as HTMLInputElement).value).toBe('50')

    await userEvent.click(screen.getByRole('button', { name: /Дієтичне/ }))

    expect(await screen.findByText('Рисова каша на воді')).toBeInTheDocument()
    expect(screen.queryByText('Гречана каша')).not.toBeInTheDocument()
    expect(screen.getByText('1-А', { selector: 'span.font-medium' })).toBeInTheDocument()
    expect((screen.getByLabelText('Вартість блюда') as HTMLInputElement).value).toBe('65')

    await userEvent.click(screen.getByRole('button', { name: 'Додати Компот до блюда' }))
    await vi.waitFor(() => expect(setDayPrice).toHaveBeenCalled())
    expect(addMenuItem).toHaveBeenCalledWith(DATE, 'dk', 'sm1')
    expect(setDayPrice).toHaveBeenCalledWith(DATE, 65, 'sm1')
  })

  // Сервер не підміняє порожнє спецменю основним — ці класи не змогли б замовити.
  it('день із порожнім спецменю не публікується', async () => {
    listSpecialMenus.mockResolvedValue([specialMenu('sm1', '', [{ id: 'c1', name: '1-А' }])])
    listMenuItems.mockResolvedValue([menuItem('mi1', 'Гречана каша', 'second')])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Гречана каша')
    await userEvent.click(screen.getByRole('button', { name: /Опублікувати/ }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('нове спецменю: обрані класи йдуть на сервер, зайняті іншим меню — вимкнені', async () => {
    listSpecialMenus.mockResolvedValue([specialMenu('sm1', 'Дієтичне', [{ id: 'c1', name: '1-А' }])])
    listMenuItems.mockResolvedValue([menuItem('mi1', 'Гречана каша', 'second')])
    saveSpecialMenu.mockResolvedValue('sm2')

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Гречана каша')
    await userEvent.click(screen.getByRole('button', { name: 'Спеціальне меню' }))

    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('checkbox', { name: /1-А/ })).toBeDisabled()
    await userEvent.type(within(dialog).getByLabelText('Назва (необов’язково)'), 'Без глютену')
    await userEvent.click(within(dialog).getByRole('checkbox', { name: '7-А' }))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Створити' }))

    await vi.waitFor(() => expect(saveSpecialMenu).toHaveBeenCalled())
    expect(saveSpecialMenu).toHaveBeenCalledWith({
      menuDate: DATE, name: 'Без глютену', classIds: ['c7'], id: null,
    })
  })

  it('без жодного класу спецменю не створюється', async () => {
    listMenuItems.mockResolvedValue([menuItem('mi1', 'Гречана каша', 'second')])

    renderWithProviders(<MenuEditorPage />, { role: 'cafeteria' })
    await screen.findByText('Гречана каша')
    await userEvent.click(screen.getByRole('button', { name: 'Спеціальне меню' }))
    const dialog = await screen.findByRole('dialog')
    await within(dialog).findByRole('checkbox', { name: '7-А' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Створити' }))

    expect(await within(dialog).findByText('Оберіть хоча б один клас.')).toBeInTheDocument()
    expect(saveSpecialMenu).not.toHaveBeenCalled()
  })
})
