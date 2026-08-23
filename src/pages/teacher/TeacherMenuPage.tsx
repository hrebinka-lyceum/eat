import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listMenuDays, listMenuItemsPlainRange, type MenuItemPlain } from '@/api/menu'
import { qk } from '@/lib/queryKeys'
import { shiftIso } from '@/lib/dates'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  formatCutoff,
  formatDateWithWeekday,
  toIsoDate,
} from '@/lib/format'
import { csvFilename } from '@/lib/csv'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const DAYS_AHEAD = 13

/**
 * Меню на найближчі дні, лише перегляд.
 *
 * Цін тут немає навіть у запиті: listMenuItemsPlainRange їх не читає.
 * Довідник страв сервер віддає всім, тож не показати ціну — робота фронтенду.
 */
export default function TeacherMenuPage() {
  const from = toIsoDate()
  const to = shiftIso(from, DAYS_AHEAD)

  const daysQuery = useQuery({
    queryKey: qk.menuDays(from, to),
    queryFn: () => listMenuDays(from, to),
  })

  const itemsQuery = useQuery({
    queryKey: qk.menuItemsPlainRange(from, to),
    queryFn: () => listMenuItemsPlainRange(from, to),
  })

  const byDate = useMemo(() => {
    const map = new Map<string, MenuItemPlain[]>()
    for (const item of itemsQuery.data ?? []) {
      const list = map.get(item.menu_date) ?? []
      list.push(item)
      map.set(item.menu_date, list)
    }
    return map
  }, [itemsQuery.data])

  const csvRows = useMemo(() => {
    return (daysQuery.data ?? []).flatMap((day) =>
      (byDate.get(day.menu_date) ?? []).map((item) => ({
        menu_date: day.menu_date,
        status: day.status,
        category: item.dishes.category,
        name: item.dishes.name,
      })),
    )
  }, [daysQuery.data, byDate])

  const days = daysQuery.data ?? []
  const loading = daysQuery.isPending || itemsQuery.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Меню"
        description="Найближчі дні. Склад на неопублікованих днях ще може змінитися."
        actions={
          <ExportButton
            rows={csvRows}
            filename={csvFilename('меню')}
            columns={[
              { header: 'Дата', value: (r) => r.menu_date },
              { header: 'Стан дня', value: (r) => (r.status === 'published' ? 'опубліковано' : 'чернетка') },
              { header: 'Категорія', value: (r) => CATEGORY_LABELS[r.category] },
              { header: 'Страва', value: (r) => r.name },
            ]}
          />
        }
      />

      {daysQuery.error ? <ErrorState error={daysQuery.error} /> : null}
      {itemsQuery.error ? <ErrorState error={itemsQuery.error} /> : null}
      {loading ? <LoadingState /> : null}

      {!loading && days.length === 0 ? (
        <EmptyState
          title="Меню на найближчі два тижні ще немає"
          hint="Його складає працівник їдальні. Загляньте сюди пізніше."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {days.map((day) => {
          const items = byDate.get(day.menu_date) ?? []
          const groups = CATEGORY_ORDER.map((category) => ({
            category,
            items: items.filter((item) => item.dishes.category === category),
          })).filter((group) => group.items.length > 0)

          return (
            <Card key={day.menu_date}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{formatDateWithWeekday(day.menu_date)}</CardTitle>
                  <Badge variant={day.status === 'published' ? 'default' : 'secondary'}>
                    {day.status === 'published' ? 'Опубліковано' : 'Ще не опубліковано'}
                  </Badge>
                </div>
                {day.status === 'published' ? (
                  <p className="text-sm text-muted-foreground">
                    Замовлення приймаються до {formatCutoff(day.cutoff_at)}
                  </p>
                ) : null}
              </CardHeader>
              <CardContent>
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Страв ще не додано.</p>
                ) : (
                  <div className="space-y-3">
                    {groups.map((group) => (
                      <div key={group.category}>
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          {CATEGORY_LABELS[group.category]}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-sm">
                          {group.items.map((item) => (
                            <li key={item.id}>{item.dishes.name}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
