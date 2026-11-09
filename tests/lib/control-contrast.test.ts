import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Рамка чекбокса має бути видно: контраст до фону щонайменше 3:1
 * (WCAG 1.4.11, межі елементів керування). Колишня рамка кольору --input
 * давала 1,2:1 у світлій темі — порожній чекбокс зливався з білим.
 */
const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

/** Змінні з блоку, що починається з `opener {` (без вкладених дужок). */
function block(opener: string): Map<string, string> {
  const start = css.indexOf(`${opener} {`)
  if (start < 0) throw new Error(`немає блоку «${opener}»`)
  const body = css.slice(start, css.indexOf('}', start))
  return new Map([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]))
}

/**
 * Відносна яскравість сірого oklch(L 0 0). Для нульової хроми лінійні
 * R = G = B = L³, тож і яскравість — L³. Кольорові й напівпрозорі значення
 * не приймаються: контраст напівпрозорої рамки залежить від того, що під нею.
 */
function luminance(value: string): number {
  const match = value.match(/^oklch\(\s*([\d.]+)\s+0\s+0\s*\)$/)
  if (!match) throw new Error(`очікувався непрозорий сірий oklch(L 0 0), а не «${value}»`)
  return Number(match[1]) ** 3
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const themes = {
  'світла тема': block('\n:root'),
  'темна тема': block('\n.dark'),
  // Друк з увімкненою темною темою: діють усі три шари — світлий, темний
  // і друкований поверх. Чого друкований блок не перевизначив, лишається темним.
  'друк із темною темою': new Map([...block('\n:root'), ...block('\n.dark'), ...block('\n  .dark')]),
}

describe('контраст рамки чекбокса', () => {
  for (const [name, vars] of Object.entries(themes)) {
    it(`${name}: щонайменше 3:1 і до фону сторінки, і до картки`, () => {
      const border = vars.get('control-border')
      expect(border, 'не задано --control-border').toBeDefined()
      for (const surface of ['background', 'card']) {
        expect(contrast(border!, vars.get(surface)!)).toBeGreaterThanOrEqual(3)
      }
    })
  }

  it('стара рамка (--input світлої теми) цю перевірку не пройшла б', () => {
    expect(contrast(themes['світла тема'].get('input')!, themes['світла тема'].get('background')!)).toBeLessThan(1.5)
  })
})
