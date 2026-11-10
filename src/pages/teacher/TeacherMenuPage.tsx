import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getClassMenus, listMenuDays } from '@/api/menu'
import { useMyClass } from '@/hooks/useMyClass'
import { qk } from '@/lib/queryKeys'
import { shiftIso } from '@/lib/dates'
import {
  formatCutoff,
  formatDateWithWeekday,
  specialMenuLabel,
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
 * Тільки опубліковані дні. RLS дозволяє керівнику бачити й чернетки, але
 * показувати їх немає сенсу: склад чернетки ще змінюється, а замовити на
 * неопублікований день керівник однаково не зможе — is_before_cutoff()
 * вимагає published. Меню в роботі — справа їдальні та адміністрації.
 *
 * Меню — саме класу керівника: якщо клас цього дня в спеціальному меню,
 * показуємо його, а не основне.
 *
 * Цін тут немає навіть у запиті: getClassMenus їх не читає.
 * Довідник страв сервер віддає всім, тож не показати ціну — робота фронтенду.
 */
export default function TeacherMenuPage() {
  const { myClass, isPending: classPending, error: classError } = useMyClass()
  const from = toIsoDate()
  const to = shiftIso(from, DAYS_AHEAD)

  const daysQuery = useQuery({
    queryKey: qk.menuDays(from, to, 'published'),
    queryFn: () => listMenuDays(from, to, { status: 'published' }),
  })

  const dates = useMemo(() => (daysQuery.data ?? []).map((day) => day.menu_date), [daysQuery.data])

  const itemsQuery = useQuery({
    queryKey: qk.classMenus(dates, myClass?.id ?? ''),
    queryFn: () => getClassMenus(dates, myClass!.id),
    enabled: daysQuery.isSuccess && Boolean(myClass),
  })

  const menus = itemsQuery.data ?? {}

  const csvRows = useMemo(() => {
    return (daysQuery.data ?? []).flatMap((day) =>
      (itemsQuery.data?.[day.menu_date]?.items ?? []).map((item) => ({
        menu_date: day.menu_date,
        category: item.dishes.category,
        name: item.dishes.name,
      })),
    )
  }, [daysQuery.data, itemsQuery.data])

  const days = daysQuery.data ?? []
  const loading =
    classPending ||
    daysQuery.isPending ||
    (daysQuery.isSuccess && dates.length > 0 && Boolean(myClass) && itemsQuery.isPending)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Меню"
        description="Блюдо на кожен опублікований день. Учень бере його цілком або ні."
        actions={
          <ExportButton
            rows={csvRows}
            filename={csvFilename('меню')}
            columns={[
              { header: 'Дата', value: (r) => r.menu_date },
              { header: 'Компонент', value: (r) => r.name },
            ]}
          />
        }
      />

      {classError ? <ErrorState error={classError} /> : null}
      {daysQuery.error ? <ErrorState error={daysQuery.error} /> : null}
      {itemsQuery.error ? <ErrorState error={itemsQuery.error} /> : null}
      {loading ? <LoadingState /> : null}

      {!loading && days.length === 0 ? (
        <EmptyState
          title="Опублікованого меню на найближчі два тижні немає"
          hint="Меню складає працівник їдальні. Дні з’являються тут після публікації."
        />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {days.map((day) => {
          const special = menus[day.menu_date]?.special ?? null
          const items = menus[day.menu_date]?.items ?? []
          const names = items
            .map((item) => item.dishes.name)
            .sort((a, b) => a.localeCompare(b, 'uk'))

          return (
            <Card key={day.menu_date}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{formatDateWithWeekday(day.menu_date)}</CardTitle>
                  {special ? <Badge variant="secondary">{specialMenuLabel(special.name)}</Badge> : null}
                </div>
                <p className="text-sm text-muted-foreground">
                  Замовлення приймаються до {formatCutoff(day.cutoff_at)}
                </p>
              </CardHeader>
              <CardContent>
                {names.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Компонентів ще не додано.</p>
                ) : (
                  <ul className="space-y-0.5 text-sm">
                    {names.map((name) => (
                      <li key={name}>{name}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
