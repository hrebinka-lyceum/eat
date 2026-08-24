import type { TooltipContentProps } from 'recharts'

/** Те, що реально потрібне від запису recharts. */
export interface TooltipEntry {
  name?: string | number
  value?: number
  color?: string
  dataKey?: string | number
}

export interface TooltipRow {
  name: string
  value: string
  color?: string
}

/**
 * Підказка при наведенні. Значення й підписи носять кольори тексту;
 * колір ряду несе лише кружечок поруч — кольоровий текст на світлому
 * тлі нечитабельний.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatLabel,
  rows,
}: Partial<TooltipContentProps<number, string>> & {
  formatLabel?: (label: string) => string
  rows: (payload: readonly TooltipEntry[]) => TooltipRow[]
}) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-popover-foreground">
        {formatLabel ? formatLabel(String(label)) : String(label)}
      </p>
      <ul className="mt-1 space-y-0.5">
        {rows(payload as readonly TooltipEntry[]).map((row) => (
          <li key={row.name} className="flex items-center gap-2 text-muted-foreground">
            {row.color ? (
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-full"
                style={{ background: row.color }}
              />
            ) : null}
            <span>{row.name}</span>
            <span className="ml-auto font-medium tabular-nums text-popover-foreground">
              {row.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
