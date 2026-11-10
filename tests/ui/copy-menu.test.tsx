import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '../helpers'

const { copyMenu, setDayPrice } = vi.hoisted(() => ({
  copyMenu: vi.fn(),
  setDayPrice: vi.fn(),
}))

vi.mock('@/api/menu', () => ({ copyMenu, setDayPrice }))

const { CopyMenuDialog } = await import('@/pages/cafeteria/components/CopyMenuDialog')

const TARGET = '2026-09-02'

beforeEach(() => {
  vi.clearAllMocks()
  copyMenu.mockResolvedValue(6)
})

const renderDialog = () =>
  renderWithProviders(
    <CopyMenuDialog open onOpenChange={() => {}} targetDate={TARGET} targetHasItems={false} />,
    { role: 'cafeteria' },
  )

describe('копіювання меню', () => {
  // Вартість кожного меню (основного й спеціальних) переносить copy_menu.
  // Колись сайт сам сумував ціни всіх компонентів дня-джерела й ставив
  // основному меню — зі спецменю ця сума склала б обидва меню докупи.
  it('копіює одним викликом сервера і не переставляє вартість сам', async () => {
    renderDialog()
    await userEvent.click(screen.getByRole('button', { name: 'Скопіювати' }))

    expect(copyMenu).toHaveBeenCalledWith('2026-09-01', TARGET)
    await vi.waitFor(() => expect(setDayPrice).not.toHaveBeenCalled())
  })

  it('попереджає, що спеціальні меню теж скопіюються', () => {
    renderDialog()
    expect(screen.getByText(/Основне меню й спеціальні \(разом із класами\)/)).toBeInTheDocument()
  })
})
