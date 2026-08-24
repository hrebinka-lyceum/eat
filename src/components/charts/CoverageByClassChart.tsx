import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_PROPS, GRID_PROPS, MARK, NO_ANIMATION, SERIES } from '@/lib/chartTheme'
import { formatPercent } from '@/lib/format'
import { ChartTooltip } from './ChartTooltip'

export interface CoveragePoint {
  class_name: string
  /** Скільки з тих, хто харчується, замовили цього дня */
  registered_pct: number | null
  /** Скільки з усього класу харчується взагалі */
  class_pct: number | null
}

/**
 * Два різні відсотки охоплення поруч.
 *
 * Плутати їх не можна, тому підписи в легенді розгорнуті до цілого речення,
 * а не «охоплення 1 / охоплення 2». Обидва — відсотки, тож спільна вісь тут
 * законна: це одна шкала 0–100, а не дві різні величини.
 */
export function CoverageByClassChart({ data }: { data: CoveragePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44 + 60)}>
      <BarChart
        data={data}
        layout="vertical"
        barGap={MARK.barGap}
        margin={{ top: 8, right: 16, bottom: 0, left: 8 }}
      >
        <CartesianGrid {...GRID_PROPS} vertical horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          {...AXIS_PROPS}
          tickFormatter={(value: number) => `${value}%`}
        />
        <YAxis type="category" dataKey="class_name" width={56} {...AXIS_PROPS} />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={
            <ChartTooltip
              rows={(payload) =>
                payload.map((entry) => ({
                  name:
                    entry.dataKey === 'registered_pct'
                      ? 'Замовили з тих, хто харчується'
                      : 'Харчуються з усього класу',
                  value: formatPercent(entry.value ?? null),
                  color: entry.color,
                }))
              }
            />
          }
        />
        <Legend
          verticalAlign="top"
          align="left"
          height={40}
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">
              {value === 'registered_pct'
                ? 'Замовили цього дня — % від тих, хто харчується'
                : 'Харчуються — % від усього класу'}
            </span>
          )}
        />
        <Bar
          {...NO_ANIMATION}
          dataKey="registered_pct"
          fill={SERIES.one}
          maxBarSize={MARK.maxBarSize}
          radius={[0, 4, 4, 0]}
        />
        <Bar
          {...NO_ANIMATION}
          dataKey="class_pct"
          fill={SERIES.two}
          maxBarSize={MARK.maxBarSize}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
