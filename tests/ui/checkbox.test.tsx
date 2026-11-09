import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Checkbox } from '@/components/ui/checkbox'

/**
 * Чекбокси на замовленні мають бути помітні й зручні для пальця.
 * Компонент згенеровано shadcn — повторна генерація мовчки повернула б
 * блідий квадрат 16 px, тож вимоги закріплено тут.
 */
describe('чекбокс', () => {
  it('рамка 2 px контрастного кольору, а не кольору поля вводу', () => {
    render(<Checkbox aria-label="Блюдо для Бойко" />)
    const box = screen.getByRole('checkbox', { name: 'Блюдо для Бойко' })
    expect(box).toHaveClass('border-2', 'border-control-border')
    expect(box.className).not.toMatch(/(^|\s)border-input(\s|$)/)
  })

  it('на телефоні 24 px, на комп’ютері 20 px', () => {
    render(<Checkbox aria-label="Обрати всіх" />)
    expect(screen.getByRole('checkbox', { name: 'Обрати всіх' })).toHaveClass('size-6', 'sm:size-5')
  })
})
