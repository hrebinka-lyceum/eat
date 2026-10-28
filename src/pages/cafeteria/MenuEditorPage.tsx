import { useEffect, useMemo, useRef, useState } from 'react'
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
  setDayPrice,
  setMenuDayStatus,
} from '@/api/menu'
import { findOrCreateComponent, listDishes } from '@/api/dishes'
import { qk } from '@/lib/queryKeys'
import { hoursUntil } from '@/lib/dates'
import {
  MENU_STATUS_LABELS,
  formatCutoff,
  formatDateWithWeekday,
  formatMoney,
  moneyToInput,
  parseMoneyInput,
  toIsoDate,
} from '@/lib/format'
import { humanError } from '@/lib/errors'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  const [priceInput, setPriceInput] = useState('')
  const [priceError, setPriceError] = useState<string | null>(null)
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

  // Склад змінюється — вартість блюда має лишитися тією самою. Тригер бази
  // проставляє новій позиції ціну з довідника, а видалення може забрати саме
  // ту позицію, що несла суму; тому після кожної зміни ціну розставляємо заново.
  const addItem = useMutation({
    mutationFn: async (dishId: string) => {
      const total = dayTotalRef.current
      await addMenuItem(activeDate, dishId)
      await setDayPrice(activeDate, total)
    },
    onSuccess: refresh,
    onError: (err) => toast.error(humanError(err)),
  })

  // Новий компонент просто з редактора: спершу в довідник (або знайдений там
  // наявний), потім у блюдо — з тим самим відновленням вартості, що й вище.
  const addNewComponent = useMutation({
    mutationFn: async (name: string) => {
      const total = dayTotalRef.current
      const dish = await findOrCreateComponent(name)
      await addMenuItem(activeDate, dish.id)
      await setDayPrice(activeDate, total)
      return dish
    },
    onSuccess: async (dish) => {
      await refresh()
      await queryClient.invalidateQueries({ queryKey: ['dishes'] })
      toast.success(`«${dish.name}» додано до блюда і в довідник`)
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const removeItem = useMutation({
    mutationFn: async (menuItemId: string) => {
      const total = dayTotalRef.current
      await removeMenuItem(menuItemId)
      await setDayPrice(activeDate, total)
    },
    onSuccess: refresh,
    onError: (err) => toast.error(humanError(err)),
  })

  const changePrice = useMutation({
    mutationFn: (price: number | null) => setDayPrice(activeDate, price),
    onSuccess: async () => {
      await refresh()
      toast.success('Вартість блюда оновлено')
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

  const components = useMemo(
    () => [...items].sort((a, b) => a.dishes.name.localeCompare(b.dishes.name, 'uk')),
    [items],
  )

  // Ціну несе один компонент, тож сума дорівнює вартості блюда.
  const dayTotal = items.reduce((sum, item) => sum + (item.price ?? 0), 0)
  const hasPrice = items.some((item) => item.price !== null)
  const dayTotalRef = useRef<number | null>(null)
  dayTotalRef.current = hasPrice ? dayTotal : null
  const hoursLeft = day ? hoursUntil(day.cutoff_at) : null
  const shortNotice = hoursLeft !== null && hoursLeft < SHORT_NOTICE_HOURS
  const busy =
    addItem.isPending || addNewComponent.isPending || removeItem.isPending || changePrice.isPending

  const onPublishClick = () => {
    if (items.length === 0) {
      toast.error('Блюдо порожнє — спершу додайте компоненти.')
      return
    }
    setPublishOpen(true)
  }

  // Поле ціни слідує за обраним днем: інакше в ньому лишалася б сума
  // попереднього дня, і кухар зберіг би її не туди.
  useEffect(() => {
    setPriceError(null)
    setPriceInput(hasPrice ? moneyToInput(dayTotal) : '')
  }, [activeDate, hasPrice, dayTotal])

  const commitPrice = () => {
    const parsed = parseMoneyInput(priceInput)
    if (parsed.error) {
      setPriceError(parsed.error)
      return
    }
    setPriceError(null)
    const current = hasPrice ? dayTotal : null
    if (parsed.value !== current) changePrice.mutate(parsed.value)
  }

  const loading = date === null || dayQuery.isPending || itemsQuery.isPending

  return (
    <div className="space-y-6">
      <PageHeader
        title="Редактор меню"
        description="Блюдо на день: кілька компонентів і одна вартість на все."
        actions={
          <>
            <ExportButton
              rows={items}
              filename={`меню-${activeDate}.csv`}
              columns={[
                { header: 'Дата', value: () => activeDate },
                { header: 'Компонент', value: (i: MenuItemWithDish) => i.dishes.name },
                {
                  header: 'Вартість блюда, ₴',
                  value: (i: MenuItemWithDish) => (i.price === null ? '' : i.price),
                },
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
            <span className="text-muted-foreground">Компонентів: {items.length}</span>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <Label htmlFor="day-price" className="whitespace-nowrap text-muted-foreground">
                Вартість блюда
              </Label>
              <Input
                id="day-price"
                inputMode="decimal"
                className="w-28 text-right tabular-nums"
                placeholder="—"
                disabled={items.length === 0 || changePrice.isPending}
                value={priceInput}
                onChange={(e) => setPriceInput(e.target.value)}
                onBlur={commitPrice}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                }}
              />
              <span className="text-muted-foreground">₴</span>
            </div>
          </div>

          {priceError ? (
            <p className="text-sm text-destructive">{priceError}</p>
          ) : null}

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
              {components.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="font-medium">Блюдо на цей день ще не складено</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Додайте компоненти праворуч або скопіюйте склад з іншого дня.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {components.map((item) => (
                    <MenuItemRow
                      key={item.id}
                      item={item}
                      disabled={busy}
                      onRemove={() => removeItem.mutate(item.id)}
                    />
                  ))}
                </div>
              )}

              {components.length > 0 && !hasPrice ? (
                <p className="text-sm text-muted-foreground">
                  Вартість блюда ще не вказана — у звіті про відшкодування цей день
                  додасть нуль.
                </p>
              ) : null}
            </div>

            <div className="lg:sticky lg:top-20 lg:self-start">
              {dishesQuery.error ? <ErrorState error={dishesQuery.error} /> : null}
              <DishPicker
                dishes={dishesQuery.data ?? []}
                usedDishIds={usedDishIds}
                disabled={busy}
                onAdd={(dish) => addItem.mutate(dish.id)}
                onCreate={(name) => addNewComponent.mutateAsync(name)}
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

      {/* Діалоги публікації існують лише разом із днем: їхні тексти
          посилаються на cutoff_at, а пропси обчислюються навіть коли
          діалог закритий. */}
      {day ? (
        <>
          <ConfirmDialog
            open={publishOpen}
            onOpenChange={setPublishOpen}
            title={`Опублікувати блюдо на ${formatDateWithWeekday(activeDate)}?`}
            description={
              shortNotice ? (
                <>
                  {hoursLeft !== null && hoursLeft <= 0
                    ? `Час прийому замовлень на цей день уже минув (${formatCutoff(day.cutoff_at)}). Учні не зможуть нічого замовити — замовлення за них зможе зробити лише адміністратор.`
                    : `Замовлення приймаються лише до ${formatCutoff(day.cutoff_at)} — це менше ніж за ${SHORT_NOTICE_HOURS} години. Учні матимуть дуже мало часу.`}
                </>
              ) : (
                <>
                  Учні побачать блюдо й зможуть замовляти до {formatCutoff(day.cutoff_at)}.
                  Компонентів: {items.length}, вартість: {formatMoney(hasPrice ? dayTotal : null)}.
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
        </>
      ) : null}

    </div>
  )
}
