import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { AXIS_PROPS, GRID_PROPS, MARK, NO_ANIMATION, SERIES } from '@/lib/chartTheme'
import { formatDateWithWeekday, formatPercent } from '@/lib/format'
import { ChartTooltip } from './ChartTooltip'

export interface CoverageTrendPoint {
  menu_date: string
  registered_pct: number | null
  students_ordered: number
  students_registered: number
}

/**
 * Один ряд — частка тих, хто замовив, серед тих, хто харчується.
 * Легенди немає навмисно: ряд один, і його називає заголовок.
 */
export function CoverageTrendChart({ data }: { data: CoverageTrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis
          dataKey="menu_date"
          {...AXIS_PROPS}
          tickFormatter={(value: string) => value.slice(8, 10) + '.' + value.slice(5, 7)}
        />
        <YAxis
          domain={[0, 100]}
          ticks={[0, 25, 50, 75, 100]}
          width={52}
          {...AXIS_PROPS}
          tickFormatter={(value: number) => `${value}%`}
        />
        <Tooltip
          content={
            <ChartTooltip
              formatLabel={formatDateWithWeekday}
              rows={(payload) => {
                const point = data.find((item) => item.registered_pct === payload[0]?.value)
                return [
                  {
                    name: 'Замовили з тих, хто харчується',
                    value: formatPercent(payload[0]?.value ?? null),
                    color: payload[0]?.color,
                  },
                  ...(point
                    ? [
                        {
                          name: 'Замовили / у реєстрі',
                          value: `${point.students_ordered} з ${point.students_registered}`,
                        },
                      ]
                    : []),
                ]
              }}
            />
          }
        />
        <Line
          {...NO_ANIMATION}
          type="monotone"
          dataKey="registered_pct"
          stroke={SERIES.one}
          strokeWidth={MARK.lineWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          connectNulls
          dot={{
            r: MARK.dotRadius,
            fill: SERIES.one,
            stroke: SERIES.surface,
            strokeWidth: 2,
          }}
          activeDot={{ r: 6, fill: SERIES.one, stroke: SERIES.surface, strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
