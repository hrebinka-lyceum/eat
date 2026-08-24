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
import { formatDateWithWeekday } from '@/lib/format'
import { ChartTooltip } from './ChartTooltip'

export interface OrdersByDayPoint {
  menu_date: string
  privileged: number
  regular: number
}

/**
 * Замовлення по днях, поділені на пільгові та звичайні.
 *
 * Стовпчик складений, бо разом вони дають усі замовлення дня — це
 * частина-до-цілого, а не два незалежні ряди. Сегменти розділені зазором
 * кольором тла, а не рамкою.
 */
export function OrdersByDayChart({ data }: { data: OrdersByDayPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="menu_date"
          {...AXIS_PROPS}
          tickFormatter={(value: string) => value.slice(8, 10) + '.' + value.slice(5, 7)}
        />
        <YAxis {...AXIS_PROPS} allowDecimals={false} width={48} />
        <Tooltip
          cursor={{ fill: 'var(--muted)', opacity: 0.5 }}
          content={
            <ChartTooltip
              formatLabel={formatDateWithWeekday}
              rows={(payload) =>
                payload.map((entry) => ({
                  name: entry.dataKey === 'privileged' ? 'Пільгові' : 'Звичайні',
                  value: String(entry.value ?? 0),
                  color: entry.color,
                }))
              }
            />
          }
        />
        <Legend
          verticalAlign="top"
          align="left"
          height={28}
          formatter={(value) => (
            <span className="text-xs text-muted-foreground">
              {value === 'privileged' ? 'Пільгові' : 'Звичайні'}
            </span>
          )}
        />
        <Bar
          {...NO_ANIMATION}
          dataKey="regular"
          stackId="orders"
          fill={SERIES.one}
          stroke={SERIES.surface}
          strokeWidth={MARK.stackGap}
          maxBarSize={MARK.maxBarSize}
        />
        <Bar
          {...NO_ANIMATION}
          dataKey="privileged"
          stackId="orders"
          fill={SERIES.two}
          stroke={SERIES.surface}
          strokeWidth={MARK.stackGap}
          maxBarSize={MARK.maxBarSize}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
