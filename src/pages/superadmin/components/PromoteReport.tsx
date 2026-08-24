import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CircleCheck } from 'lucide-react'
import { toast } from 'sonner'
import { listClasses, setClassTeacher } from '@/api/classes'
import { listUnassignedTeachers } from '@/api/profiles'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { LoadingState } from '@/components/common/states'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { PromoteResult } from '@/types/database'

const NO_TEACHER = 'none'

/**
 * Звіт про переведення року й одразу за ним — призначення керівників.
 *
 * Це навмисно один екран: нові п'яті класи створюються порожніми й без
 * керівника, а керівники випущених одинадцятих щойно звільнилися. Змушувати
 * шукати цей крок окремо означало б залишити школу без класних керівників
 * до першої скарги.
 */
export function PromoteReport({ report }: { report: PromoteResult }) {
  const queryClient = useQueryClient()

  const classesQuery = useQuery({
    queryKey: qk.classes(report.new_year),
    queryFn: () => listClasses(report.new_year),
  })

  const freeTeachersQuery = useQuery({
    queryKey: ['unassigned-teachers'],
    queryFn: listUnassignedTeachers,
  })

  const assign = useMutation({
    mutationFn: ({ classId, teacherId }: { classId: string; teacherId: string | null }) =>
      setClassTeacher(classId, teacherId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['classes'] })
      await queryClient.invalidateQueries({ queryKey: ['unassigned-teachers'] })
      toast.success('Керівника призначено')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const withoutTeacher = (classesQuery.data ?? []).filter((item) => item.teacher_id === null)
  const freeTeachers = freeTeachersQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Переведення року виконано"
        description={`${report.previous_year} → ${report.new_year}`}
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CircleCheck className="size-5 text-primary" aria-hidden />
            <CardTitle className="text-base">Що змінилося</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <p>
            Дата початку: <strong>{formatDate(report.start_date)}</strong>
          </p>
          <p>
            Класів створено: <strong>{report.classes_created}</strong>
          </p>
          <p>
            Учнів переведено: <strong>{report.students_moved}</strong>
          </p>
          <p>
            Учнів випущено: <strong>{report.students_graduated}</strong>
          </p>
          <p className="sm:col-span-2">
            Нових вхідних класів: <strong>{report.entry_classes}</strong> — вони порожні
            й поки без керівників.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Призначте керівників</CardTitle>
          <CardDescription>
            Це продовження тієї самої дії, а не окреме завдання. Керівники випущених
            одинадцятих щойно звільнилися — вони у списку вільних.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {classesQuery.isPending ? <LoadingState /> : null}

          {withoutTeacher.length === 0 && !classesQuery.isPending ? (
            <p className="text-sm text-muted-foreground">
              Усі класи {report.new_year} мають керівників. Нічого робити не треба.
            </p>
          ) : null}

          {withoutTeacher.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
            >
              <span className="font-medium">{item.name}</span>
              <Select
                disabled={assign.isPending}
                onValueChange={(value) =>
                  assign.mutate({
                    classId: item.id,
                    teacherId: value === NO_TEACHER ? null : value,
                  })
                }
              >
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Обрати керівника" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_TEACHER}>Поки без керівника</SelectItem>
                  {freeTeachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}

          {withoutTeacher.length > 0 && freeTeachers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Вільних керівників немає — усі вже ведуть класи. Створити нового можна
              в розділі «Користувачі».
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  )
}
