import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarPlus, Copy, Eye, EyeOff, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
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
import { deleteSpecialMenu, listSpecialMenus } from '@/api/specialMenus'
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
  specialMenuLabel,
  toIsoDate,
} from '@/lib/format'
import { humanError } from '@/lib/errors'
import { cn } from '@/lib/utils'
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
import { SpecialMenuDialog } from './components/SpecialMenuDialog'
import type { MenuItemWithDish } from '@/api/menu'
import type { SpecialMenuWithClasses } from '@/api/specialMenus'

/** Менше цього часу до дедлайну — публікувати вже пізно, попереджаємо. */
const SHORT_NOTICE_HOURS = 2

/** До якого меню належить компонент: null — основне. */
const menuOf = (item: MenuItemWithDish) => item.special_menu_id ?? null

/**
 * Редактор меню дня. Основне меню — одне на всю школу; на той самий день
 * можна додати спеціальні меню для окремих класів, кожне зі своїм складом і
 * вартістю. Статус (чернетка/опубліковано) і дедлайн — спільні для дня.
 */
export default function MenuEditorPage() {
  const queryClient = useQueryClient()
  const [date, setDate] = useState<string | null>(null)
  /** обране меню: null — основне, інакше id спеціального */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [generateOpen, setGenerateOpen] = useState(false)
  const [copyOpen, setCopyOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [priceInput, setPriceInput] = useState('')
  const [priceError, setPriceError] = useState<string | null>(null)
  const [unpublishOpen, setUnpublishOpen] = useState(false)
  const [specialDialog, setSpecialDialog] = useState<{ menu: SpecialMenuWithClasses | null } | null>(
    null,
  )
  const [toDelete, setToDelete] = useState<SpecialMenuWithClasses | null>(null)

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

  // Інший день — знову основне меню: спеціальні меню в кожного дня свої.
  const changeDate = (next: string) => {
    setDate(next)
    setSelectedId(null)
  }

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

  const specialQuery = useQuery({
    queryKey: qk.specialMenus(activeDate),
    queryFn: () => listSpecialMenus(activeDate),
    enabled: date !== null,
  })

  const dishesQuery = useQuery({
    queryKey: qk.dishes(false),
    queryFn: () => listDishes(),
  })

  const specialMenus = useMemo(() => specialQuery.data ?? [], [specialQuery.data])
  // Обране меню могли щойно видалити (або перемкнули день) — тоді основне.
  const selected = specialMenus.find((menu) => menu.id === selectedId) ?? null
  const menuId = selected?.id ?? null

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: qk.menuItems(activeDate) }),
      queryClient.invalidateQueries({ queryKey: qk.menuDay(activeDate) }),
      queryClient.invalidateQueries({ queryKey: ['menu-next-empty'] }),
      queryClient.invalidateQueries({ queryKey: ['menu-days'] }),
      queryClient.invalidateQueries({ queryKey: ['special-menus'] }),
      queryClient.invalidateQueries({ queryKey: ['menu-items-plain'] }),
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
  // ту позицію, що несла суму; тому після кожної зміни ціну розставляємо заново —
  // у межах того самого меню (основного чи спеціального).
  const addItem = useMutation({
    mutationFn: async (dishId: string) => {
      const total = menuTotalRef.current
      await addMenuItem(activeDate, dishId, menuId)
      await setDayPrice(activeDate, total, menuId)
    },
    onSuccess: refresh,
    onError: (err) => toast.error(humanError(err)),
  })

  // Новий компонент просто з редактора: спершу в довідник (або знайдений там
  // наявний), потім у меню — з тим самим відновленням вартості, що й вище.
  const addNewComponent = useMutation({
    mutationFn: async (name: string) => {
      const total = menuTotalRef.current
      const dish = await findOrCreateComponent(name)
      await addMenuItem(activeDate, dish.id, menuId)
      await setDayPrice(activeDate, total, menuId)
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
      const total = menuTotalRef.current
      await removeMenuItem(menuItemId)
      await setDayPrice(activeDate, total, menuId)
    },
    onSuccess: refresh,
    onError: (err) => toast.error(humanError(err)),
  })

  const changePrice = useMutation({
    mutationFn: (price: number | null) => setDayPrice(activeDate, price, menuId),
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

  const removeSpecial = useMutation({
    mutationFn: (menu: SpecialMenuWithClasses) => deleteSpecialMenu(menu.id),
    onSuccess: async () => {
      setToDelete(null)
      setSelectedId(null)
      await refresh()
      toast.success('Спеціальне меню видалено — ці класи знову отримують основне')
    },
    onError: (err) => {
      setToDelete(null)
      toast.error(humanError(err))
    },
  })

  const day = dayQuery.data ?? null
  const allItems = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data])
  const mainItems = useMemo(() => allItems.filter((item) => menuOf(item) === null), [allItems])
  // Компоненти обраного меню — з ними працюють і список, і пошук, і вартість.
  const items = useMemo(() => allItems.filter((item) => menuOf(item) === menuId), [allItems, menuId])
  const usedDishIds = useMemo(() => new Set(items.map((item) => item.dish_id)), [items])

  const components = useMemo(
    () => [...items].sort((a, b) => a.dishes.name.localeCompare(b.dishes.name, 'uk')),
    [items],
  )

  // Ціну несе один компонент меню, тож сума дорівнює вартості блюда.
  const total = (list: MenuItemWithDish[]) =>
    list.some((item) => item.price !== null)
      ? list.reduce((sum, item) => sum + (item.price ?? 0), 0)
      : null
  const menuTotal = total(items)
  const hasPrice = menuTotal !== null
  const mainTotal = total(mainItems)
  const menuTotalRef = useRef<number | null>(null)
  menuTotalRef.current = menuTotal
  const hoursLeft = day ? hoursUntil(day.cutoff_at) : null
  const shortNotice = hoursLeft !== null && hoursLeft < SHORT_NOTICE_HOURS
  const busy =
    addItem.isPending || addNewComponent.isPending || removeItem.isPending || changePrice.isPending

  const emptySpecial = specialMenus.find(
    (menu) => !allItems.some((item) => menuOf(item) === menu.id),
  )

  const onPublishClick = () => {
    if (mainItems.length === 0) {
      toast.error('Блюдо порожнє — спершу додайте компоненти.')
      return
    }
    // Класи порожнього спецменю не змогли б замовити взагалі — сервер не
    // підміняє його основним.
    if (emptySpecial) {
      toast.error(
        `Спеціальне меню «${specialMenuLabel(emptySpecial.name)}» порожнє — додайте склад або видаліть меню.`,
      )
      return
    }
    setPublishOpen(true)
  }

  // Поле ціни слідує за обраним днем і меню: інакше в ньому лишалася б сума
  // попереднього, і кухар зберіг би її не туди.
  useEffect(() => {
    setPriceError(null)
    setPriceInput(menuTotal !== null ? moneyToInput(menuTotal) : '')
  }, [activeDate, menuId, menuTotal])

  const commitPrice = () => {
    const parsed = parseMoneyInput(priceInput)
    if (parsed.error) {
      setPriceError(parsed.error)
      return
    }
    setPriceError(null)
    if (parsed.value !== menuTotal) changePrice.mutate(parsed.value)
  }

  const loading = date === null || dayQuery.isPending || itemsQuery.isPending

  const labelOf = (item: MenuItemWithDish) => {
    const special = specialMenus.find((menu) => menu.id === menuOf(item))
    return special ? specialMenuLabel(special.name) : 'Основне'
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Редактор меню"
        description="Блюдо на день: кілька компонентів і одна вартість на все. За потреби — спеціальні меню для окремих класів."
        actions={
          <>
            <ExportButton
              rows={allItems}
              filename={`меню-${activeDate}.csv`}
              columns={[
                { header: 'Дата', value: () => activeDate },
                { header: 'Меню', value: (i: MenuItemWithDish) => labelOf(i) },
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

      <DayPicker value={activeDate} onChange={changeDate} />

      {dayQuery.error ? <ErrorState error={dayQuery.error} /> : null}
      {itemsQuery.error ? <ErrorState error={itemsQuery.error} /> : null}
      {specialQuery.error ? <ErrorState error={specialQuery.error} /> : null}

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

          {/* Перемикач меню дня. Основне — для всіх класів, крім тих, що в спеціальних. */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Меню дня">
            <MenuTab active={menuId === null} onClick={() => setSelectedId(null)}>
              Основне меню
            </MenuTab>
            {specialMenus.map((menu) => (
              <MenuTab key={menu.id} active={menuId === menu.id} onClick={() => setSelectedId(menu.id)}>
                {specialMenuLabel(menu.name)}
                <span className="text-xs opacity-70">
                  {menu.classes.map((klass) => klass.name).join(', ')}
                </span>
              </MenuTab>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setSpecialDialog({ menu: null })}>
              <Plus className="size-4" aria-hidden />
              Спеціальне меню
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
            {selected ? (
              <>
                <span>
                  <span className="text-muted-foreground">Для класів: </span>
                  <span className="font-medium">
                    {selected.classes.map((klass) => klass.name).join(', ')}
                  </span>
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSpecialDialog({ menu: selected })}
                >
                  <Pencil className="size-4" aria-hidden />
                  Класи й назва
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setToDelete(selected)}>
                  <Trash2 className="size-4" aria-hidden />
                  Видалити меню
                </Button>
              </>
            ) : (
              <span className="text-muted-foreground">
                {specialMenus.length > 0
                  ? 'Для всіх класів, крім тих, що мають спеціальне меню.'
                  : 'Для всіх класів.'}
              </span>
            )}
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

          {priceError ? <p className="text-sm text-destructive">{priceError}</p> : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
            <div className="space-y-4">
              {components.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="font-medium">
                    {selected
                      ? 'Спеціальне меню ще не складено'
                      : 'Блюдо на цей день ще не складено'}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected
                      ? 'Додайте компоненти праворуч. Поки меню порожнє, ці класи не зможуть замовити.'
                      : 'Додайте компоненти праворуч або скопіюйте склад з іншого дня.'}
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
                  Вартість блюда ще не вказана — у звіті про відшкодування{' '}
                  {selected ? 'це меню додасть' : 'цей день додасть'} нуль.
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
        targetHasItems={allItems.length > 0 || specialMenus.length > 0}
      />

      <SpecialMenuDialog
        open={specialDialog !== null}
        onOpenChange={(open) => !open && setSpecialDialog(null)}
        menuDate={activeDate}
        menu={specialDialog?.menu ?? null}
        dayMenus={specialMenus}
        onSaved={setSelectedId}
      />

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Видалити «${specialMenuLabel(toDelete?.name)}»?`}
        description={`Класи ${toDelete?.classes.map((klass) => klass.name).join(', ') ?? ''} знову отримуватимуть основне меню. Меню, за яким уже замовляли, видалити не вийде.`}
        confirmLabel="Видалити"
        destructive
        busy={removeSpecial.isPending}
        onConfirm={() => toDelete && removeSpecial.mutate(toDelete)}
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
                  Компонентів: {mainItems.length}, вартість: {formatMoney(mainTotal)}.
                  {specialMenus.length > 0
                    ? ` Спеціальних меню: ${specialMenus.length} — для класів ${specialMenus
                        .flatMap((menu) => menu.classes.map((klass) => klass.name))
                        .join(', ')}.`
                    : ''}
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

function MenuTab({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Button
      variant={active ? 'default' : 'outline'}
      size="sm"
      aria-pressed={active}
      className={cn('h-auto min-h-8 flex-col items-start gap-0 py-1 text-left', !active && 'bg-background')}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}
