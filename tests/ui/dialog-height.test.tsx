import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'

describe('вікно', () => {
  // Регресія: без обмеження висоти картка учня з 30 замовленнями виростала
  // вище за екран, і до вкладок угорі неможливо було дістатися. jsdom
  // розмітки не рахує, тож перевіряємо самі правила.
  it('не вище за екран і прокручується всередині', () => {
    render(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Довгий вміст</DialogTitle>
        </DialogContent>
      </Dialog>,
    )
    const content = screen.getByRole('dialog')
    expect(content.className).toMatch(/max-h-\[calc\(100dvh-2rem\)\]/)
    expect(content.className).toMatch(/overflow-y-auto/)
  })
})
