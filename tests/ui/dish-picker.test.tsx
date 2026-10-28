import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DishPicker } from '@/pages/cafeteria/components/DishPicker'
import type { Dish } from '@/types/database'

const dish = (id: string, name: string): Dish => ({ id, name, category: 'second', price: null, is_active: true })
const DISHES = [dish('d1', 'Гречана каша'), dish('d2', 'Чай'), dish('d3', 'Чай з лимоном')]

function renderPicker(onCreate = vi.fn().mockResolvedValue(undefined)) {
  render(<DishPicker dishes={DISHES} usedDishIds={new Set()} onAdd={vi.fn()} onCreate={onCreate} />)
  return { onCreate, search: screen.getByLabelText('Пошук компонента') }
}

describe('новий компонент з редактора меню', () => {
  it('немає такого — пропонує додати і додає', async () => {
    const { onCreate, search } = renderPicker()
    await userEvent.type(search, '  перець  свіжий')

    await userEvent.click(screen.getByRole('button', { name: 'Додати «Перець свіжий» як новий компонент' }))

    expect(onCreate).toHaveBeenCalledWith('Перець свіжий')
    expect(search).toHaveValue('')
  })

  // «чай» уже є як «Чай» — пропонувати дубль не можна.
  it('точно такий уже є (без урахування регістру) — створити не пропонує', async () => {
    const { search } = renderPicker()
    await userEvent.type(search, 'чай')
    expect(screen.queryByRole('button', { name: /як новий компонент/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Додати Чай до блюда' })).toBeInTheDocument()
  })

  it('Enter створює, коли нічого не знайдено', async () => {
    const { onCreate, search } = renderPicker()
    await userEvent.type(search, 'Виноград{Enter}')
    expect(onCreate).toHaveBeenCalledWith('Виноград')
  })

  // Поки набирають «Чай з…», Enter не має створити дубль «Чай з» замість
  // наявного «Чай з лимоном».
  it('Enter нічого не створює, поки є збіги', async () => {
    const { onCreate, search } = renderPicker()
    await userEvent.type(search, 'Чай з{Enter}')
    expect(onCreate).not.toHaveBeenCalled()
  })

  it('не вдалося — назва лишається, щоб не набирати знову', async () => {
    const { search } = renderPicker(vi.fn().mockRejectedValue(new Error('мережа')))
    await userEvent.type(search, 'Виноград{Enter}')
    expect(search).toHaveValue('Виноград')
  })
})
