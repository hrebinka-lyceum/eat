import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Copy, Eye, EyeOff, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import {
  addMenuItem,
  createMenuDay,
  getMenuDay,
  getNextEmptyDay,
  listMenuItems,
  removeMenuItem,
  setMenuDayStatus,
  setMenuItemPrice,
} from '@/api/menu'
import { listDishes } from '@/api/dishes'
import { qk } from '@/lib/queryKeys'
import { hoursUntil } from '@/lib/dates'
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  MENU_STATUS_LABELS,
  formatCutoff,
  formatDateWithWeekday,
  formatMoney,
  toIsoDate,
} from '@/lib/format'
import { humanError } from '@/lib/errors'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DayPicker } from './components/DayPicker'
import { DishPicker } from './components/DishPicker'
import { MenuItemRow } from './components/MenuItemRow'
import { GenerateDaysDialog } from './components/GenerateDaysDialog'
import { CopyMenuDialog } from './components/CopyMenuDialog'
import type { MenuItemWithDish } from '@/api/menu'

/** Менше цього часу до дедлайну — публікувати вже пізно, попереджаємо. */
const SHORT_NOTICE_HOURS = 2

export default function MenuEditorPage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState<string | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [unpublishOpen, setUnpublishOpen] = useState(false)

  // Робочий режим — щоденний: відкриваємо найближчий незаповнений день.
  const nextEmptyQuery = useQuery({
    queryKey: qk.nextEmptyDay(),
    queryFn: () => getNextEmptyDay(),
    enabled: date === null,
  })

  useEffect(() => {
    if (date !== null || nextEmptyQuery.isPending) return
    setDate(nextEmptyQuery.data?.menu_date ?? toIsoDate())
  }, [date, nextEmptyQuery.isPending, nextEmptyQuery.data])

  const activeDate = date ?? toIsoDate()

  const dayQuery = useQuery({
    queryKey: qk.menuDay(activeDate),
    queryFn: () => getMenuDay(activeDate),
    enabled: date !== null,
  })

  const itemsQuery = useQuery({
    queryKey: qk.menuItems(activeDate),
    queryFn: () => listMenuItems(activeDate),
    enabled: date !== null,
  })

  const dishesQuery = useQuery({
    queryKey: qk.dishes(false),
    queryFn: () => listDishes(),
  })

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.menuItems(activeDate) }),
      queryClient.invalidateQueries({ queryKey: qk.menuDay(activeDate) }),
      queryClient.invalidateQueries({ queryKey: ['menu-next-empty'] }),
      queryClient.invalidateQueries({ queryKey: ['menu-days'] }),
    ])
  }

  const createDay = useMutation({
    mutationFn: () => createMenuDay(activeDate),
    onSuccess: async () => {
      await refresh()
      toast.success('День створено')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const addItem = useMutation({
    mutationFn: (dishId: string) => addMenuItem(activeDate, dishId),
    onSuccess: refresh,
    onError: (err) => toast.error(humanError(err)),
  })

  const removeItem = useMutation({
    mutationFn: (menuItemId: string) => removeMenuItem(menuItemId),
    onSuccess: refresh,
    onError: (err) => toast.error(humanError(err)),
  })

  const changePrice = useMutation({
    mutationFn: ({ id, price }: { id: string; price: number | null }) => setMenuItemPrice(id, price),
    onSuccess: async () => {
      await refresh()
      toast.success('Ціну на цей день оновлено')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const changeStatus = useMutation({
    mutationFn: (status: 'draft' | 'published') => setMenuDayStatus(activeDate, status),
    onSuccess: async (day) => {
      await refresh()
      setPublishOpen(false)
      setUnpublishOpen(false)
      toast.success(
        day.status === 'published'
          ? 'Меню опубліковано — учні його бачать'
          : 'Меню повернуто в чернетку',
      )
    },
    onError: (err) => {
      toast.error(humanError(err))
      setPublishOpen(false)
      setUnpublishOpen(false)
    },
  })

  const day = dayQuery.data ?? null
  const items = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const usedDishIds = useMemo(() => new Set(items.map((item) => item.dish_id)), [items])

  const grouped = useMemo(() => {
    return CATEGORY_ORDER.map((category) => ({
      category,
      items: items
        .filter((item) => item.dishes.category === category)
        .sort((a, b) => a.dishes.name.localeCompare(b.dishes.name, 'uk')),
    })).filter((group) => group.items.length > 0)
  }, [items])

  const dayTotal = items.reduce((sum, item) => sum + (item.price ?? 0), 0)
  const hoursLeft = day ? hoursUntil(day.cutoff_at) : null
  const shortNotice = hoursLeft !== null && hoursLeft < SHORT_NOTICE_HOURS
  const busy = addItem.isPending || removeItem.isPending || changePrice.isPending

  const onPublishClick = () => {
    if (items.length === 0) {
      toast.error('Меню порожнє — спершу додайте страви.')
      return
    }
    setPublishOpen(true)
  }

  const loading = date === null || dayQuery.isPending || itemsQuery.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Редактор меню"
        description="Щоденний режим: відкривається найближчий незаповнений день."
        actions={
          <>
            <ExportButton
              rows={items}
              filename={`меню-${activeDate}.csv`}
              columns={[
                { header: 'Дата', value: () => activeDate },
                { header: 'Категорія', value: (i: MenuItemWithDish) => CATEGORY_LABELS[i.dishes.category] },
                { header: 'Страва', value: (i: MenuItemWithDish) => i.dishes.name },
                { header: 'Ціна, ₴', value: (i: MenuItemWithDish) => i.price ?? '' },
              ]}
            />
            <Button variant="outline" size="sm" onClick={() => setGenerateOpen(true)}>
              <CalendarPlus className="size-4" aria-hidden />
              Згенерувати дні
            </Button>
            <Button variant="outline" size="sm" disabled={!day} onClick={() => setCopyOpen(true)}>
              <Copy className="size-4" aria-hidden />
              Скопіювати з дня
            </Button>
            {day?.status === 'published' ? (
              <Button variant="outline" size="sm" onClick={() => setUnpublishOpen(true)}>
                <EyeOff className="size-4" aria-hidden />
                У чернетку
              </Button>
            ) : (
              <Button size="sm" disabled={!day} onClick={onPublishClick}>
                <Eye className="size-4" aria-hidden />
                Опублікувати
              </Button>
            )}
          </>
        }
      />

      <DayPicker value={activeDate} onChange={setDate} />

      {dayQuery.error ? <ErrorState error={dayQuery.error} /> : null}
      {itemsQuery.error ? <ErrorState error={itemsQuery.error} /> : null}

      {loading ? <LoadingState /> : null}

      {!loading && !day ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              День {formatDateWithWeekday(activeDate)} ще не створено
            </CardTitle>
            <CardDescription>
              Меню складається лише для створених днів. Створіть цей день або згенеруйте
              одразу весь місяць.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button disabled={createDay.isPending} onClick={() => createDay.mutate()}>
              Створити день
            </Button>
            <Button variant="outline" onClick={() => setGenerateOpen(true)}>
              Згенерувати дні на місяць
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {!loading && day ? (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            <Badge variant={day.status === 'published' ? 'default' : 'secondary'}>
              {MENU_STATUS_LABELS[day.status]}
            </Badge>
            <span className="text-muted-foreground">
              Замовлення приймаються до {formatCutoff(day.cutoff_at)}
            </span>
            <span className="text-muted-foreground">Позицій: {items.length}</span>
            <span className="ml-auto tabular-nums">
              Сума меню: <strong>{formatMoney(dayTotal)}</strong>
            </span>
          </div>

          {day.status === 'draft' && shortNotice ? (
            <Alert>
              <TriangleAlert className="size-4" aria-hidden />
              <AlertTitle>До кінця прийому замовлень лишилось мало часу</AlertTitle>
              <AlertDescription>
                Замовлення на цей день приймаються до {formatCutoff(day.cutoff_at)}. Якщо
                опублікувати меню зараз, учні майже не встигнуть замовити.
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-4">
              {grouped.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="font-medium">Меню на цей день порожнє</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Додайте страви праворуч або скопіюйте склад з іншого дня.
                  </p>
                </div>
              ) : null}

              {grouped.map((group) => (
                <div key={group.category} className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {CATEGORY_LABELS[group.category]}
                  </p>
                  {group.items.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      disabled={busy}
                      onPriceChange={(price) => changePrice.mutate({ id: item.id, price })}
                      onRemove={() => removeItem.mutate(item.id)}
                    />
                  ))}
                </div>
              ))}
            </div>

            <div className="lg:sticky lg:top-20 lg:self-start">
              {dishesQuery.error ? <ErrorState error={dishesQuery.error} /> : null}
              <DishPicker
                dishes={dishesQuery.data ?? []}
                usedDishIds={usedDishIds}
                disabled={busy}
                onAdd={(dish) => addItem.mutate(dish.id)}
              />
            </div>
          </div>
        </>
      ) : null}

      <GenerateDaysDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        anchorDate={activeDate}
      />

      <CopyMenuDialog
        open={copyOpen}
        onOpenChange={setCopyOpen}
        targetDate={activeDate}
        targetHasItems={items.length > 0}
      />

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title={`Опублікувати меню на ${formatDateWithWeekday(activeDate)}?`}
        description={
          shortNotice ? (
            <>
              {hoursLeft !== null && hoursLeft <= 0
                ? `Час прийому замовлень на цей день уже минув (${formatCutoff(day?.cutoff_at ?? '')}). Учні не зможуть нічого замовити — замовлення за них зможе зробити лише адміністратор.`
                : `Замовлення приймаються лише до ${formatCutoff(day?.cutoff_at ?? '')} — це менше ніж за ${SHORT_NOTICE_HOURS} години. Учні матимуть дуже мало часу.`}
            </>
          ) : (
            <>
              Учні побачать меню й зможуть замовляти до {formatCutoff(day?.cutoff_at ?? '')}.
              Позицій у меню: {items.length}.
            </>
          )
        }
        confirmLabel="Опублікувати"
        busy={changeStatus.isPending}
        onConfirm={() => changeStatus.mutate('published')}
      />

      <ConfirmDialog
        open={unpublishOpen}
        onOpenChange={setUnpublishOpen}
        title="Повернути меню в чернетку?"
        description="Учні перестануть бачити цей день і не зможуть замовляти. Уже зроблені замовлення залишаться."
        confirmLabel="У чернетку"
        destructive
        busy={changeStatus.isPending}
        onConfirm={() => changeStatus.mutate('draft')}
      />
    </div>
  )
}
