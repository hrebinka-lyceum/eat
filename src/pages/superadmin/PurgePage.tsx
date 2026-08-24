import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { OctagonAlert, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { purgeData, purgePreview } from '@/api/admin'
import { humanError } from '@/lib/errors'
import { shiftIso } from '@/lib/dates'
import { formatDate, toIsoDate } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import type { PurgePreview, PurgeResult, PurgeScope } from '@/types/database'

/**
 * Сервер відмовляється чіпати дані свіжіші за 30 днів (purge_data перевіряє
 * p_to >= current_date - 30). Пояснюємо це до спроби й не даємо ввести
 * пізнішу дату — краще підказка, ніж помилка з бази.
 */
const MIN_AGE_DAYS = 31

const CONFIRM_WORD = 'ВИДАЛИТИ'

interface ScopeInfo {
  id: PurgeScope
  label: string
  description: string
  count: (preview: PurgePreview) => number
}

const SCOPES: ScopeInfo[] = [
  {
    id: 'orders',
    label: 'Замовлення',
    description: 'Замовлення й їхній склад за вказаний період.',
    count: (p) => p.orders,
  },
  {
    id: 'menus',
    label: 'Дні меню',
    description:
      'Дні меню разом зі складом. Якщо в періоді лишаються замовлення, сервер відмовить — тоді треба додати категорію «Замовлення».',
    count: (p) => p.menu_days,
  },
  {
    id: 'privilege_log',
    label: 'Журнал пільг',
    description: 'Записи про зміни пільгового статусу за період.',
    count: (p) => p.privilege_log,
  },
  {
    id: 'graduated_students',
    label: 'Випущені учні',
    description:
      'Картки учнів, які вибули в цьому періоді, разом з їхніми акаунтами.',
    count: (p) => p.graduated_students,
  },
]

export default function PurgePage() {
  const queryClient = useQueryClient()
  const today = toIsoDate()
  const maxTo = shiftIso(today, -MIN_AGE_DAYS)

  const [from, setFrom] = useState(shiftIso(maxTo, -365))
  const [to, setTo] = useState(maxTo)
  const [scopes, setScopes] = useState<PurgeScope[]>([])
  const [confirm, setConfirm] = useState('')
  const [preview, setPreview] = useState<PurgePreview | null>(null)
  const [result, setResult] = useState<PurgeResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const tooRecent = to > maxTo
  const badRange = from > to

  const previewMutation = useMutation({
    mutationFn: () => purgePreview(from, to),
    onSuccess: (data) => {
      setPreview(data)
      setResult(null)
      setError(null)
    },
    onError: (err) => setError(humanError(err)),
  })

  const purgeMutation = useMutation({
    mutationFn: () => purgeData(from, to, scopes, confirm),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries()
      setResult(data)
      setPreview(null)
      setScopes([])
      setConfirm('')
      toast.success('Дані видалено')
    },
    onError: (err) => setError(humanError(err)),
  })

  const selectedCount = useMemo(() => {
    if (!preview) return 0
    return SCOPES.filter((scope) => scopes.includes(scope.id)).reduce(
      (sum, scope) => sum + scope.count(preview),
      0,
    )
  }, [preview, scopes])

  const graduatedSelected = scopes.includes('graduated_students')
  const menusWithoutOrders =
    scopes.includes('menus') && !scopes.includes('orders') && (preview?.orders ?? 0) > 0

  const canPurge =
    scopes.length > 0 && confirm === CONFIRM_WORD && !tooRecent && !badRange && !menusWithoutOrders

  const toggleScope = (scope: PurgeScope, checked: boolean) => {
    setScopes((current) =>
      checked ? [...current, scope] : current.filter((item) => item !== scope),
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Видалення даних за період"
        description="Потрібне, щоб не тримати персональні дані дітей довше, ніж треба. Дія незворотна."
      />

      <Alert>
        <OctagonAlert className="size-4" aria-hidden />
        <AlertTitle>Відновити видалене неможливо</AlertTitle>
        <AlertDescription>
          Резервної копії система не робить. Спершу подивіться, скільки чого потрапляє
          під видалення, і лише потім підтверджуйте.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Період</CardTitle>
          <CardDescription>
            Видаляти можна лише дані, старші за 30 днів. Тому кінець періоду не може бути
            пізнішим за {formatDate(maxTo)} — це обмеження самої бази, і обійти його
            не вийде.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="purge-from">З дати</Label>
              <Input
                id="purge-from"
                type="date"
                className="w-44"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value)
                  setPreview(null)
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purge-to">По дату</Label>
              <Input
                id="purge-to"
                type="date"
                className="w-44"
                max={maxTo}
                value={to}
                onChange={(e) => {
                  setTo(e.target.value)
                  setPreview(null)
                }}
              />
            </div>
            <Button
              className="mb-1"
              variant="outline"
              disabled={tooRecent || badRange || previewMutation.isPending}
              onClick={() => previewMutation.mutate()}
            >
              {previewMutation.isPending ? 'Рахуємо…' : 'Порахувати'}
            </Button>
          </div>

          {tooRecent ? (
            <Alert>
              <TriangleAlert className="size-4" aria-hidden />
              <AlertTitle>Кінець періоду занадто свіжий</AlertTitle>
              <AlertDescription>
                Оберіть дату не пізнішу за {formatDate(maxTo)}. Дані молодші за 30 днів
                сервер видаляти відмовляється — це захист від помилки в даті.
              </AlertDescription>
            </Alert>
          ) : null}

          {badRange ? (
            <Alert>
              <TriangleAlert className="size-4" aria-hidden />
              <AlertTitle>Початок періоду пізніший за кінець</AlertTitle>
              <AlertDescription>Перевірте дати.</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      {preview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Що потрапляє під видалення</CardTitle>
            <CardDescription>
              За {formatDate(from)} — {formatDate(to)}. Оберіть категорії; нічого ще
              не видалено.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {SCOPES.map((scope) => {
              const count = scope.count(preview)
              return (
                <label
                  key={scope.id}
                  className="flex cursor-pointer items-start gap-3 rounded-lg border p-3"
                >
                  <Checkbox
                    className="mt-0.5"
                    checked={scopes.includes(scope.id)}
                    disabled={count === 0}
                    onCheckedChange={(value) => toggleScope(scope.id, value === true)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium">{scope.label}</span>
                      <span className="text-sm tabular-nums text-muted-foreground">
                        {count === 0 ? 'нічого немає' : `записів: ${count}`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-sm text-muted-foreground">{scope.description}</p>
                  </div>
                </label>
              )
            })}

            <p className="text-xs text-muted-foreground">
              Разом із замовленнями видаляється і їхній склад — {preview.order_items} позицій,
              а з днями меню — {preview.menu_items} позицій меню.
            </p>

            {graduatedSelected ? (
              <Alert>
                <OctagonAlert className="size-4" aria-hidden />
                <AlertTitle>«Випущені учні» стирають більше, ніж період</AlertTitle>
                <AlertDescription>
                  Разом з карткою учня зникає <strong>вся</strong> його історія замовлень —
                  зокрема та, що поза вказаним періодом. Ці діти більше не з’являться в
                  жодному звіті за минулі роки. Якщо історія потрібна для звітності,
                  спершу вивантажте її в CSV.
                </AlertDescription>
              </Alert>
            ) : null}

            {menusWithoutOrders ? (
              <Alert>
                <TriangleAlert className="size-4" aria-hidden />
                <AlertTitle>Дні меню не видаляться</AlertTitle>
                <AlertDescription>
                  У періоді лишаються замовлення ({preview.orders}), а на них спираються дні
                  меню. Додайте категорію «Замовлення» або звузьте період.
                </AlertDescription>
              </Alert>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {preview && scopes.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">3. Підтвердження</CardTitle>
            <CardDescription>
              Під видалення потрапляє {selectedCount} записів в обраних категоріях.
              Щоб підтвердити, введіть слово {CONFIRM_WORD} великими літерами.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="purge-confirm">Підтвердження</Label>
              <Input
                id="purge-confirm"
                className="max-w-56"
                autoComplete="off"
                placeholder={CONFIRM_WORD}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            {error ? <ErrorState error={new Error(error)} /> : null}

            <Button
              variant="destructive"
              disabled={!canPurge || purgeMutation.isPending}
              onClick={() => {
                setError(null)
                purgeMutation.mutate()
              }}
            >
              {purgeMutation.isPending ? 'Видаляємо…' : 'Видалити назавжди'}
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {error && !preview ? <ErrorState error={new Error(error)} /> : null}

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Видалено</CardTitle>
            <CardDescription>Запис про операцію збережено в журналі видалень.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {result.orders !== undefined ? <p>Замовлень: {result.orders}</p> : null}
            {result.menu_days !== undefined ? <p>Днів меню: {result.menu_days}</p> : null}
            {result.privilege_log !== undefined ? (
              <p>Записів журналу пільг: {result.privilege_log}</p>
            ) : null}
            {result.graduated_students !== undefined ? (
              <p>Карток випущених учнів: {result.graduated_students}</p>
            ) : null}
            {result.auth_users_note ? (
              <p className="text-muted-foreground">{result.auth_users_note}</p>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
