import { useEffect, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getSettings, updateSettings } from '@/api/settings'
import { listClasses } from '@/api/classes'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { PageHeader } from '@/components/common/PageHeader'
import { ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { TriangleAlert } from 'lucide-react'

export default function SettingsPage() {
  const queryClient = useQueryClient()
  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })

  const [cutoffTime, setCutoffTime] = useState('08:00')
  const [daysBefore, setDaysBefore] = useState('0')
  const [currentYear, setCurrentYear] = useState('')
  const [loginDomain, setLoginDomain] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Класи поточного року — щоб одразу показати, чи збігається рік у
  // налаштуваннях із тим, що стоїть у класах.
  const classesQuery = useQuery({
    queryKey: qk.classes(currentYear || undefined),
    queryFn: () => listClasses(currentYear),
    enabled: Boolean(currentYear),
  })

  useEffect(() => {
    const data = settingsQuery.data
    if (!data) return
    setCutoffTime(data.cutoff_time.slice(0, 5))
    setDaysBefore(String(data.cutoff_days_before))
    setCurrentYear(data.current_year)
    setLoginDomain(data.login_domain)
  }, [settingsQuery.data])

  const save = useMutation({
    mutationFn: () =>
      updateSettings({
        cutoff_time: cutoffTime,
        cutoff_days_before: Number(daysBefore),
        current_year: currentYear.trim(),
        login_domain: loginDomain.trim(),
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: qk.settings() })
      await queryClient.invalidateQueries({ queryKey: ['classes'] })
      await queryClient.invalidateQueries({ queryKey: ['my-class'] })
      toast.success('Налаштування збережено')
    },
    onError: (err) => setError(humanError(err)),
  })

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    const days = Number(daysBefore)
    if (!Number.isInteger(days) || days < 0 || days > 7) {
      setError('Кількість днів до дедлайну — ціле число від 0 до 7.')
      return
    }
    if (!currentYear.trim()) {
      setError('Вкажіть навчальний рік.')
      return
    }
    if (!/^[a-z0-9.-]+$/i.test(loginDomain.trim())) {
      setError('Домен логінів може містити лише латиницю, цифри, крапку й дефіс.')
      return
    }
    save.mutate()
  }

  if (settingsQuery.isPending) return <LoadingState />
  if (settingsQuery.error) return <ErrorState error={settingsQuery.error} />

  const savedYear = settingsQuery.data?.current_year ?? ''
  const yearMismatch =
    classesQuery.data !== undefined && classesQuery.data.length === 0 && currentYear === savedYear

  return (
    <div className="space-y-6">
      <PageHeader
        title="Налаштування"
        description="Час прийому замовлень, навчальний рік і домен для логінів."
      />

      <form onSubmit={onSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Прийом замовлень</CardTitle>
            <CardDescription>
              Разом ці два поля задають дедлайн. 0 днів і 08:00 означає «о 8:00 самого
              дня харчування»; 1 день і 15:00 — «о 15:00 напередодні».
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="cutoff-time">Час закриття</Label>
              <Input
                id="cutoff-time"
                type="time"
                value={cutoffTime}
                onChange={(e) => setCutoffTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cutoff-days">За скільки днів</Label>
              <Input
                id="cutoff-days"
                type="number"
                min={0}
                max={7}
                value={daysBefore}
                onChange={(e) => setDaysBefore(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Нові дні меню отримають цей дедлайн при створенні. Уже створеним дням
              час не переписується.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Навчальний рік</CardTitle>
            <CardDescription>
              Має точно збігатися з роком у класах. Розбіжність хоч в одному символі
              залишає класних керівників без класів — без жодного повідомлення.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="current-year">Поточний рік</Label>
              <Input
                id="current-year"
                className="max-w-48"
                placeholder="2026/2027"
                value={currentYear}
                onChange={(e) => setCurrentYear(e.target.value)}
              />
            </div>

            {yearMismatch ? (
              <Alert>
                <TriangleAlert className="size-4" aria-hidden />
                <AlertTitle>На цей рік немає жодного класу</AlertTitle>
                <AlertDescription>
                  Перевірте написання: у класах рік може бути записаний інакше.
                  Поки вони не збігаються, керівники не побачать своїх класів.
                </AlertDescription>
              </Alert>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Змінювати вручну треба лише для виправлення помилки. Звичайний перехід на
              новий рік робиться на екрані «Переведення року» — він і рік оновить, і
              класи перерахує.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Домен логінів</CardTitle>
            <CardDescription>
              З нього будуються нові логіни: «petrenko.o@домен». Пошта на ці адреси не
              ходить — вони синтетичні.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="login-domain">Домен</Label>
              <Input
                id="login-domain"
                className="max-w-64"
                placeholder="school.local"
                value={loginDomain}
                onChange={(e) => setLoginDomain(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Зміна діє лише на майбутні логіни. Уже видані залишаються на старому
                домені й працюють далі.
              </p>
            </div>
          </CardContent>
        </Card>

        {error ? <ErrorState error={new Error(error)} /> : null}

        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? 'Зберігаємо…' : 'Зберегти налаштування'}
          </Button>
        </div>
      </form>
    </div>
  )
}
