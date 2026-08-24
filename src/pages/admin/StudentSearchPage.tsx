import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { KeyRound, Search, Star } from 'lucide-react'
import { searchStudents, type StudentWithClass } from '@/api/students'
import { csvFilename } from '@/lib/csv'
import { formatDate, fullName } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AdminStudentDialog } from './components/AdminStudentDialog'

const MIN_LENGTH = 2

/**
 * Пошук учня по всій школі — головний інструмент адміністратора.
 *
 * Пошук серверний (ilike), бо шукати доводиться серед усіх класів, а не
 * в уже завантаженому списку.
 */
export default function StudentSearchPage() {
  const [term, setTerm] = useState('')
  const [debounced, setDebounced] = useState('')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [selected, setSelected] = useState<StudentWithClass | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(term.trim()), 300)
    return () => window.clearTimeout(timer)
  }, [term])

  const searchQuery = useQuery({
    queryKey: ['student-search', debounced, includeInactive],
    queryFn: () => searchStudents(debounced, { includeInactive }),
    enabled: debounced.length >= MIN_LENGTH,
    placeholderData: (previous) => previous,
  })

  const results = useMemo(() => searchQuery.data ?? [], [searchQuery.data])

  // Картку тримаємо свіжою: після зміни пільги чи класу список перечитується.
  useEffect(() => {
    if (!selected) return
    const fresh = results.find((item) => item.id === selected.id)
    if (fresh && fresh !== selected) setSelected(fresh)
  }, [results, selected])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Пошук учня"
        description="По всій школі. Звідси ж — замовлення за учня, скасування, пільги й переведення."
        actions={
          <ExportButton
            rows={results}
            filename={csvFilename('пошук-учнів')}
            columns={[
              { header: 'Прізвище', value: (s) => s.last_name },
              { header: 'Ім’я', value: (s) => s.first_name },
              { header: 'Клас', value: (s) => s.classes?.name ?? '' },
              { header: 'Пільга', value: (s) => s.is_privileged },
              { header: 'Має логін', value: (s) => Boolean(s.profile_id) },
              { header: 'Харчується з', value: (s) => s.enrolled_from },
              { header: 'У реєстрі', value: (s) => s.is_active },
            ]}
          />
        }
      />

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1 space-y-2">
          <Label htmlFor="school-search">Прізвище або ім’я</Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="school-search"
              className="pl-8"
              placeholder="Наприклад, Петренко"
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-2 pb-2">
          <Switch id="include-left" checked={includeInactive} onCheckedChange={setIncludeInactive} />
          <Label htmlFor="include-left" className="font-normal">
            Показувати тих, хто вибув
          </Label>
        </div>
      </div>

      {debounced.length < MIN_LENGTH ? (
        <EmptyState
          title="Введіть щонайменше дві літери"
          hint="Пошук іде по прізвищу та імені серед усіх класів школи."
        />
      ) : null}

      {searchQuery.isPending && debounced.length >= MIN_LENGTH ? <LoadingState /> : null}
      {searchQuery.error ? <ErrorState error={searchQuery.error} /> : null}

      {debounced.length >= MIN_LENGTH && !searchQuery.isPending && results.length === 0 ? (
        <EmptyState
          title="Нікого не знайдено"
          hint="Перевірте написання. У реєстрі є лише ті, хто харчується в школі."
        />
      ) : null}

      {results.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Учень</TableHead>
                <TableHead>Клас</TableHead>
                <TableHead>Пільга</TableHead>
                <TableHead>Логін</TableHead>
                <TableHead>Харчується з</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map((student) => (
                <TableRow
                  key={student.id}
                  className={student.is_active ? 'cursor-pointer' : 'cursor-pointer opacity-60'}
                  onClick={() => setSelected(student)}
                >
                  <TableCell className="font-medium">
                    {fullName(student.last_name, student.first_name)}
                    {student.is_active ? null : (
                      <span className="ml-2 text-xs text-muted-foreground">вибув</span>
                    )}
                  </TableCell>
                  <TableCell>{student.classes?.name ?? '—'}</TableCell>
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
                  <TableCell className="text-muted-foreground">
                    {formatDate(student.enrolled_from)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <AdminStudentDialog student={selected} onOpenChange={() => setSelected(null)} />
    </div>
  )
}
