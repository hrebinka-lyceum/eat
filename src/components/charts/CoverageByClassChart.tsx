import {
  Bar,
  BarChart,
  CartesianGrid,
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
  /** яка частка класу замовила цього дня */
  pct: number | null
  ordered: number
  /** учнів у класі (за списком) */
  registered: number
}

/**
 * Охоплення по класах за день: яка частка класу замовила. Список класу — це
 * всі учні, тож відсоток один і рахується від усього класу.
 */
export function CoverageByClassChart({ data }: { data: CoveragePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 32 + 60)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 0, left: 8 }}>
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
                payload.map((entry) => {
                  const point = entry.payload as CoveragePoint | undefined
                  return {
                    name: 'Замовили',
                    value: point
                      ? `${point.ordered} з ${point.registered} (${formatPercent(point.pct)})`
                      : formatPercent(entry.value ?? null),
                    color: entry.color,
                  }
                })
              }
            />
          }
        />
        <Bar
          {...NO_ANIMATION}
          dataKey="pct"
          fill={SERIES.one}
          maxBarSize={MARK.maxBarSize}
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
