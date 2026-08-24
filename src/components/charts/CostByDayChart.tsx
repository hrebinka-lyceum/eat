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
import { formatDateWithWeekday, formatMoney } from '@/lib/format'
import { ChartTooltip } from './ChartTooltip'

export interface CostByDayPoint {
  menu_date: string
  cost: number
}

/**
 * Вартість по днях. Один ряд — отже без легенди: що саме намальовано,
 * каже заголовок. Окремий графік, а не друга вісь на попередньому:
 * гривні й порції не діляться спільною шкалою.
 */
export function CostByDayChart({ data }: { data: CostByDayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="menu_date"
          {...AXIS_PROPS}
          tickFormatter={(value: string) => value.slice(8, 10) + '.' + value.slice(5, 7)}
        />
        <YAxis
          {...AXIS_PROPS}
          width={64}
          tickFormatter={(value: number) => new Intl.NumberFormat('uk-UA').format(value)}
        />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={
            <ChartTooltip
              formatLabel={formatDateWithWeekday}
              rows={(payload) =>
                payload.map((entry) => ({
                  name: 'Вартість',
                  value: formatMoney(entry.value ?? 0),
                  color: entry.color,
                }))
              }
            />
          }
        />
        <Bar
          {...NO_ANIMATION}
          dataKey="cost"
          fill={SERIES.one}
          maxBarSize={MARK.maxBarSize}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
