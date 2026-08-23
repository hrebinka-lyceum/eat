import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CircleCheck, Info, KeyRound, Plus, Search, Star } from 'lucide-react'
import { listStudentsOfClass } from '@/api/students'
import { listOrdersPlainOfClass } from '@/api/orders'
import { useMyClass } from '@/hooks/useMyClass'
import { usePublishedDays } from '@/hooks/usePublishedDays'
import { qk } from '@/lib/queryKeys'
import { csvFilename } from '@/lib/csv'
import { formatDate, fullName } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { CredentialsDialog } from '@/components/common/CredentialsDialog'
import { useCredentialsFlow } from '@/hooks/useCredentialsFlow'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PublishedDaySelect } from './components/PublishedDaySelect'
import { AddStudentDialog } from './components/AddStudentDialog'
import { StudentCardDialog } from './components/StudentCardDialog'
import type { Student } from '@/types/database'

/**
 * Реєстр класу — ті, хто харчується.
 *
 * Це принципово не список класу: скільки дітей у класі загалом, знає лише
 * classes.total_students, і ставить його адміністрація.
 */
export default function ClassRosterPage() {
  const { myClass, isPending: classPending, error: classError } = useMyClass()
  const { days } = usePublishedDays()
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<Student | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const credentials = useCredentialsFlow()

  const activeDay = day ?? days[0]?.menu_date ?? null

  const studentsQuery = useQuery({
    queryKey: qk.students(myClass?.id ?? '', showInactive),
    queryFn: () => listStudentsOfClass(myClass!.id, { includeInactive: showInactive }),
    enabled: Boolean(myClass),
  })

  const ordersQuery = useQuery({
    queryKey: qk.ordersOfClass(myClass?.id ?? '', activeDay ?? ''),
    queryFn: () => listOrdersPlainOfClass(myClass!.id, activeDay!),
    enabled: Boolean(myClass) && Boolean(activeDay),
  })

  const orderedIds = useMemo(
    () => new Set((ordersQuery.data ?? []).map((order) => order.student_id)),
    [ordersQuery.data],
  )

  const students = studentsQuery.data ?? []
  const activeCount = students.filter((student) => student.is_active).length

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return students
    return students.filter(
      (student) =>
        student.last_name.toLowerCase().includes(term) ||
        student.first_name.toLowerCase().includes(term),
    )
  }, [students, search])

  // Логін можна видати лише тому, у кого його ще немає.
  const selectable = visible.filter((student) => student.is_active && !student.profile_id)
  const checkedSet = new Set(checked)
  const selectedWithoutLogin = selectable.filter((student) => checkedSet.has(student.id))

  const toggleAll = (value: boolean) => {
    setChecked(value ? selectable.map((student) => student.id) : [])
  }

  const issueForSelected = () => {
    const names = new Map(
      selectedWithoutLogin.map((student) => [
        student.id,
        fullName(student.last_name, student.first_name),
      ]),
    )
    void credentials.issue(
      selectedWithoutLogin.map((student) => student.id),
      names,
    ).then(() => setChecked([]))
  }

  if (classPending) return <LoadingState />
  if (classError) return <ErrorState error={classError} />

  // Керівник без класу — реальний стан після переведення року.
  if (!myClass) {
    return (
      <div className="space-y-6">
        <PageHeader title="Мій клас" />
        <EmptyState
          title="За вами не закріплено клас у поточному навчальному році"
          hint="Це буває після переведення року. Зверніться до адміністрації — вона призначить клас."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Клас ${myClass.name}`}
        description="Список тих, хто харчується. Це не список класу: вносьте лише дітей, які їдять у школі."
        actions={
          <>
            <ExportButton
              rows={visible}
              filename={csvFilename(`клас-${myClass.name}`)}
              columns={[
                { header: 'Прізвище', value: (s) => s.last_name },
                { header: 'Ім’я', value: (s) => s.first_name },
                { header: 'Пільга', value: (s) => s.is_privileged },
                { header: 'Підстава пільги', value: (s) => s.privilege_note ?? '' },
                { header: 'Має логін', value: (s) => Boolean(s.profile_id) },
                { header: 'Харчується з', value: (s) => s.enrolled_from },
                { header: 'У реєстрі', value: (s) => s.is_active },
              ]}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={selectedWithoutLogin.length === 0 || credentials.busy}
              onClick={issueForSelected}
            >
              <KeyRound className="size-4" aria-hidden />
              {selectedWithoutLogin.length > 0
                ? `Видати логіни (${selectedWithoutLogin.length})`
                : 'Видати логіни'}
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Додати учня
            </Button>
          </>
        }
      />

      {/* Охоплення класу: без total_students відповіді на це питання немає. */}
      <div className="rounded-lg border p-4">
        {myClass.total_students ? (
          <p className="text-sm">
            Харчуються <strong>{activeCount}</strong> із{' '}
            <strong>{myClass.total_students}</strong> учнів класу
          </p>
        ) : (
          <div className="flex items-start gap-2 text-sm">
            <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
            <p>
              Харчуються <strong>{activeCount}</strong> учнів. Скільки дітей у класі
              загалом, система не знає — це число вносить адміністрація. Без нього
              не можна сказати, яку частку класу охоплено.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[12rem] flex-1 space-y-2">
          <Label htmlFor="student-search">Пошук за прізвищем</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="student-search"
              className="pl-8"
              placeholder="Прізвище або ім’я"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <PublishedDaySelect
          days={days}
          value={activeDay}
          onChange={setDay}
          label="Замовлення на день"
        />

        <div className="flex items-center gap-2 pb-2">
          <Switch id="show-left" checked={showInactive} onCheckedChange={setShowInactive} />
          <Label htmlFor="show-left" className="font-normal">
            Показати тих, хто вибув
          </Label>
        </div>
      </div>

      {studentsQuery.isPending ? <LoadingState /> : null}
      {studentsQuery.error ? <ErrorState error={studentsQuery.error} /> : null}

      {studentsQuery.data && visible.length === 0 ? (
        <EmptyState
          title={students.length === 0 ? 'У реєстрі ще нікого немає' : 'Нікого не знайдено'}
          hint={
            students.length === 0
              ? 'Додайте дітей, які харчуються в школі. Логіни їм видавати не обов’язково — замовляти можна за них.'
              : 'Спробуйте інший пошуковий запит.'
          }
        />
      ) : null}

      {visible.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    aria-label="Обрати всіх без логіна"
                    disabled={selectable.length === 0}
                    checked={selectable.length > 0 && checked.length === selectable.length}
                    onCheckedChange={(value) => toggleAll(value === true)}
                  />
                </TableHead>
                <TableHead>Учень</TableHead>
                <TableHead>Пільга</TableHead>
                <TableHead>Логін</TableHead>
                <TableHead>
                  {activeDay ? `Замовлення на ${formatDate(activeDay)}` : 'Замовлення'}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map((student) => (
                <TableRow
                  key={student.id}
                  className={student.is_active ? 'cursor-pointer' : 'cursor-pointer opacity-60'}
                  onClick={() => setSelected(student)}
                >
                  <TableCell onClick={(event) => event.stopPropagation()}>
                    {student.is_active && !student.profile_id ? (
                      <Checkbox
                        aria-label={`Обрати ${student.last_name}`}
                        checked={checkedSet.has(student.id)}
                        onCheckedChange={(value) =>
                          setChecked((current) =>
                            value === true
                              ? [...current, student.id]
                              : current.filter((id) => id !== student.id),
                          )
                        }
                      />
                    ) : null}
                  </TableCell>
                  <TableCell className="font-medium">
                    {fullName(student.last_name, student.first_name)}
                    {student.is_active ? null : (
                      <span className="ml-2 text-xs text-muted-foreground">вибув</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {student.is_privileged ? (
                      <Badge variant="secondary">
                        <Star className="size-3" aria-hidden />
                        Пільга
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {student.profile_id ? (
                      <KeyRound className="size-4 text-muted-foreground" aria-label="Має логін" />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {!activeDay ? (
                      <span className="text-muted-foreground">немає опублікованих днів</span>
                    ) : orderedIds.has(student.id) ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <CircleCheck className="size-4 text-primary" aria-hidden />
                        Замовлено
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Логіни потрібні лише тим, хто замовлятиме сам. За решту замовляєте ви —
        це нормальний, підтримуваний стан.
      </p>

      <AddStudentDialog open={addOpen} onOpenChange={setAddOpen} classId={myClass.id} />

      <CredentialsDialog
        credentials={credentials.credentials}
        title={credentials.title}
        skipped={credentials.skipped}
        onClose={credentials.close}
      />
      <StudentCardDialog student={selected} onOpenChange={() => setSelected(null)} />
    </div>
  )
}
