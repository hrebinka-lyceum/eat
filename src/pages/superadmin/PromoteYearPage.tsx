import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, OctagonAlert } from 'lucide-react'
import { toast } from 'sonner'
import { promoteAcademicYear } from '@/api/admin'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { gradeRange, unparsableClassNames } from '@/lib/grades'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { PromoteReport } from './components/PromoteReport'
import type { PromoteResult } from '@/types/database'

/** '2026/2027' -> '2027/2028' */
function nextYearLabel(current: string): string {
  const match = current.match(/^(\d{4})\s*\/\s*(\d{4})$/)
  if (!match) return ''
  return `${Number(match[1]) + 1}/${Number(match[2]) + 1}`
}

export default function PromoteYearPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const currentYear = settingsQuery.data?.current_year ?? ''

  const classesQuery = useQuery({
    queryKey: qk.classes(currentYear || undefined),
    queryFn: () => listClasses(currentYear),
    enabled: Boolean(currentYear),
  })

  const [newYear, setNewYear] = useState('')
  const [minGrade, setMinGrade] = useState('')
  const [maxGrade, setMaxGrade] = useState('')
  const [startDate, setStartDate] = useState('')
  const [confirmYear, setConfirmYear] = useState('')
  const [report, setReport] = useState<PromoteResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const suggested = useMemo(() => nextYearLabel(currentYear), [currentYear])
  const targetYear = (newYear || suggested).trim()

  const classNames = useMemo(
    () => (classesQuery.data ?? []).map((item) => item.name),
    [classesQuery.data],
  )

  // Межі беремо з наявних класів: школа може бути 5–11, 1–11 чи будь-якою
  // іншою. Зашите число тут мовчки створило б дублікати паралелі.
  const detected = useMemo(() => gradeRange(classNames), [classNames])
  const unparsable = useMemo(() => unparsableClassNames(classNames), [classNames])

  const effectiveMin = minGrade === '' ? detected?.min : Number(minGrade)
  const effectiveMax = maxGrade === '' ? detected?.max : Number(maxGrade)
  const gradesValid =
    effectiveMin !== undefined &&
    effectiveMax !== undefined &&
    Number.isInteger(effectiveMin) &&
    Number.isInteger(effectiveMax) &&
    effectiveMin >= 1 &&
    effectiveMax > effectiveMin

  const promote = useMutation({
    mutationFn: () =>
      promoteAcademicYear(targetYear, {
        startDate: startDate || undefined,
        minGrade: effectiveMin,
        maxGrade: effectiveMax,
      }),
    onSuccess: async (data) => {
      await queryClient.invalidateQueries()
      setReport(data)
      setError(null)
      toast.success('Навчальний рік переведено')
    },
    onError: (err) => setError(humanError(err)),
  })

  if (settingsQuery.isPending) return <LoadingState />
  if (settingsQuery.error) return <ErrorState error={settingsQuery.error} />

  // Звіт і призначення керівників — продовження тієї самої дії, тому
  // одразу на цьому ж екрані, а не окремим пунктом меню.
  if (report) return <PromoteReport report={report} />

  // --- Кроки 1–2: форма і підтвердження ------------------------------------
  return (
    <div className="space-y-6">
      <PageHeader
        title="Переведення навчального року"
        description={`Поточний рік — ${currentYear}. Дія незворотна.`}
      />

      <Alert>
        <OctagonAlert className="size-4" aria-hidden />
        <AlertTitle>Що станеться після натискання</AlertTitle>
        <AlertDescription>
          <ul className="mt-1 list-inside list-disc space-y-1">
            <li>
              Кожен клас підніметься на паралель вище
              {effectiveMin !== undefined
                ? `: ${effectiveMin}-А стане ${effectiveMin + 1}-А і так далі`
                : ''}
              .
            </li>
            <li>
              {effectiveMax !== undefined ? `Класи ${effectiveMax} паралелі` : 'Випускні класи'}{' '}
              випустяться: їхні учні вийдуть з реєстру, а акаунти буде вимкнено.
            </li>
            <li>
              З’являться нові класи{' '}
              {effectiveMin !== undefined ? `${effectiveMin} паралелі` : 'наймолодшої паралелі'} —
              порожні, без керівників.
            </li>
            <li>Поточний рік у налаштуваннях зміниться на новий.</li>
          </ul>
          <p className="mt-2">
            Історія замовлень не постраждає: у кожному замовленні збережено зліпок класу
            на момент замовлення. Скасувати переведення однією кнопкою неможливо.
          </p>
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Новий рік</CardTitle>
          <CardDescription>
            Формат такий самий, як у поточному: {currentYear || '2026/2027'}. Дата початку
            за замовчуванням — 1 вересня нового року; саме нею датуються записи історії класів.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-year">Навчальний рік</Label>
            <Input
              id="new-year"
              className="max-w-48"
              placeholder={suggested || '2027/2028'}
              value={newYear || suggested}
              onChange={(e) => setNewYear(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min-grade">Наймолодша паралель</Label>
            <Input
              id="min-grade"
              type="number"
              min={1}
              max={11}
              className="max-w-24"
              placeholder={detected ? String(detected.min) : ''}
              value={minGrade}
              onChange={(e) => setMinGrade(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Її щороку добирають новими класами.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="max-grade">Випускна паралель</Label>
            <Input
              id="max-grade"
              type="number"
              min={2}
              max={12}
              className="max-w-24"
              placeholder={detected ? String(detected.max) : ''}
              value={maxGrade}
              onChange={(e) => setMaxGrade(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Її учні випускаються.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start-date">Дата початку</Label>
            <Input
              id="start-date"
              type="date"
              className="max-w-48"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Порожньо — 1 вересня.</p>
          </div>
        </CardContent>
      </Card>

      {detected ? (
        <p className="text-sm text-muted-foreground">
          У поточному році є паралелі з {detected.min} по {detected.max} — межі
          підставлені звідси. Змінюйте їх, лише якщо знаєте, що робите:
          наймолодша паралель визначає, які класи буде створено заново.
        </p>
      ) : null}

      {unparsable.length > 0 ? (
        <Alert>
          <OctagonAlert className="size-4" aria-hidden />
          <AlertTitle>Не всі назви класів розбираються на паралель</AlertTitle>
          <AlertDescription>
            {unparsable.join(', ')} — переведення зупиниться на них. Приведіть назви
            до вигляду «7-А» у розділі «Класи».
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Підтвердження</CardTitle>
          <CardDescription>
            Щоб підтвердити, введіть назву нового року вручну: <strong>{targetYear}</strong>.
            Скопіювати з поля вище — теж спосіб, але перепишіть уважно.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="confirm-year">Введіть {targetYear}</Label>
            <Input
              id="confirm-year"
              className="max-w-48"
              autoComplete="off"
              value={confirmYear}
              onChange={(e) => setConfirmYear(e.target.value)}
            />
          </div>

          {error ? <ErrorState error={new Error(error)} /> : null}

          <Button
            variant="destructive"
            disabled={
              !targetYear ||
              confirmYear.trim() !== targetYear ||
              targetYear === currentYear ||
              !gradesValid ||
              unparsable.length > 0 ||
              promote.isPending
            }
            onClick={() => {
              setError(null)
              promote.mutate()
            }}
          >
            {promote.isPending ? 'Переводимо…' : 'Перевести рік'}
            <ArrowRight className="size-4" aria-hidden />
          </Button>

          {targetYear === currentYear ? (
            <p className="text-sm text-muted-foreground">
              Новий рік збігається з поточним — вкажіть інший.
            </p>
          ) : null}

          {!gradesValid ? (
            <p className="text-sm text-muted-foreground">
              Перевірте паралелі: випускна має бути більшою за наймолодшу.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
