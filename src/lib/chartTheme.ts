/**
 * Спільні параметри графіків.
 *
 * Кольори рядів беруться з CSS-змінних (--series-*), а не задаються тут
 * рядками: так вони живуть в одному місці з рештою теми й міняються разом
 * зі світлим/темним режимом. Пара синій+оранжевий перевірена валідатором
 * палітри — розрізняється при всіх типах дальтонізму.
 */
export const SERIES = {
  one: 'var(--series-1)',
  two: 'var(--series-2)',
  grid: 'var(--series-grid)',
  axis: 'var(--series-axis)',
  surface: 'var(--series-surface)',
} as const

/** Тонкі мітки: стовпчик не ширший за 24px, лінія 2px, крапка від 8px. */
export const MARK = {
  maxBarSize: 24,
  barGap: 2,
  lineWidth: 2,
  dotRadius: 4,
  /** Зазор кольором тла між сегментами стовпчика. */
  stackGap: 2,
} as const

/**
 * Анімація вимкнена скрізь свідомо: дашборд відкривають, щоб побачити
 * число, а не рух. Заразом це знімає питання prefers-reduced-motion.
 */
export const NO_ANIMATION = { isAnimationActive: false } as const

export const AXIS_PROPS = {
  stroke: SERIES.axis,
  tickLine: false,
  axisLine: false,
  tick: { fill: 'var(--muted-foreground)', fontSize: 12 },
} as const

export const GRID_PROPS = {
  stroke: SERIES.grid,
  strokeWidth: 1,
  vertical: false,
} as const
