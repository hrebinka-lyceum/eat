import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

const { copyMenu, listMenuItems, setDayPrice } = vi.hoisted(() => ({
  copyMenu: vi.fn(),
  listMenuItems: vi.fn(),
  setDayPrice: vi.fn(),
}))

vi.mock('@/api/menu', () => ({ copyMenu, listMenuItems, setDayPrice }))

const { CopyMenuDialog } = await import('@/pages/cafeteria/components/CopyMenuDialog')

const TARGET = '2026-09-02'

const item = (id: string, name: string, price: number | null) => ({
  id, menu_date: '2026-09-01', dish_id: `d${id}`, price,
  dishes: { id: `d${id}`, name, category: 'second' as const, is_active: true },
})

beforeEach(() => {
  vi.clearAllMocks()
  copyMenu.mockResolvedValue(3)
  setDayPrice.mockResolvedValue(undefined)
})

const renderDialog = () =>
  renderWithProviders(
    <CopyMenuDialog open onOpenChange={() => {}} targetDate={TARGET} targetHasItems={false} />,
    { role: 'cafeteria' },
  )

describe('копіювання блюда', () => {
  // copy_menu бере ціни з довідника, а в компонентів їх немає — без
  // перенесення скопійований день лишався б без вартості.
  it('переносить вартість дня-джерела на цільовий день', async () => {
    listMenuItems.mockResolvedValue([
      item('mi1', 'Гречана каша', 62.5),
      item('mi2', 'Котлета', null),
      item('mi3', 'Чай', null),
    ])

    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Скопіювати' }))

    expect(copyMenu).toHaveBeenCalled()
    expect(setDayPrice).toHaveBeenCalledWith(TARGET, 62.5)
  })

  it('день-джерело без ціни не вигадує вартість цільовому', async () => {
    listMenuItems.mockResolvedValue([item('mi1', 'Гречана каша', null)])

    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Скопіювати' }))

    expect(setDayPrice).toHaveBeenCalledWith(TARGET, null)
  })
})
