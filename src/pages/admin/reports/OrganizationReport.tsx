import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileDown, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { mealOrders } from '@/api/reports'
import { classCoverage } from '@/api/stats'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { listPrivilegeCategories } from '@/api/privilegeCategories'
import { getReportSettings } from '@/api/reportSettings'
import { buildOrganizationReport } from '@/lib/mealReport'
import { organizationDocument, periodLabel, type DocTable } from '@/lib/reportDocument'
import { downloadBlob } from '@/lib/csv'
import { qk } from '@/lib/queryKeys'
import { monthValueBounds, toMonthValue } from '@/lib/dates'
import { humanError } from '@/lib/errors'
import { plural, toIsoDate } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'

function previousMonth(): string {
  const [year, month] = toMonthValue().split('-').map(Number)
  const date = new Date(year, month - 2, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Звіт про організацію харчування учнів — офіційний документ на затвердження
 * директором. Формується у DOCX (щоб можна було підправити) і PDF (щоб
 * надіслати як є). На екрані — той самий зміст, щоб бачити, що буде у файлі.
 */
export default function OrganizationReport() {
  const [initialFrom, initialTo] = monthValueBounds(toMonthValue())
  const [from, setFrom] = useState(initialFrom)
  const [to, setTo] = useState(initialTo)
  const [busy, setBusy] = useState<'docx' | 'pdf' | null>(null)
  const validPeriod = Boolean(from && to && from <= to)

  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const classesQuery = useQuery({ queryKey: qk.classes(), queryFn: () => listClasses() })
  const categoriesQuery = useQuery({
    queryKey: qk.privilegeCategories(),
    queryFn: listPrivilegeCategories,
  })
  const reportSettingsQuery = useQuery({
    queryKey: qk.reportSettings(),
    queryFn: getReportSettings,
  })
  // «Учнів у класі» — зі списку класу: найбільше за період число з охоплення.
  const coverageQuery = useQuery({
    queryKey: qk.classCoverage(from, to),
    queryFn: () => classCoverage(from, to),
    enabled: validPeriod,
  })

  const ordersQuery = useQuery({
    queryKey: qk.mealOrders(from, to),
    queryFn: () => mealOrders(from, to),
    enabled: validPeriod,
    placeholderData: (previous) => previous,
  })

  const classesWithSize = useMemo(() => {
    const size = new Map<string, number>()
    for (const row of coverageQuery.data ?? []) {
      size.set(row.class_id, Math.max(size.get(row.class_id) ?? 0, row.students_registered))
    }
    return (classesQuery.data ?? []).map((klass) => ({
      ...klass,
      total_students: size.get(klass.id) ?? null,
    }))
  }, [classesQuery.data, coverageQuery.data])

  const report = useMemo(
    () =>
      buildOrganizationReport(
        ordersQuery.data ?? [],
        classesWithSize,
        categoriesQuery.data ?? [],
        { currentYear: settingsQuery.data?.current_year ?? '' },
      ),
    [ordersQuery.data, classesWithSize, categoriesQuery.data, settingsQuery.data],
  )

  const director = reportSettingsQuery.data
  const hasDirector = Boolean(director?.director_last_name.trim())

  const model = useMemo(
    () =>
      organizationDocument(report, {
        from,
        to,
        director: director
          ? { firstName: director.director_first_name, lastName: director.director_last_name }
          : null,
        year: toIsoDate().slice(0, 4),
      }),
    [report, from, to, director],
  )

  const loading =
    ordersQuery.isLoading ||
    coverageQuery.isLoading ||
    classesQuery.isLoading ||
    settingsQuery.isLoading ||
    categoriesQuery.isLoading ||
    reportSettingsQuery.isLoading
  const error =
    ordersQuery.error ??
    coverageQuery.error ??
    classesQuery.error ??
    settingsQuery.error ??
    categoriesQuery.error ??
    reportSettingsQuery.error
  const empty = validPeriod && !loading && (ordersQuery.data ?? []).length === 0
  const ready = validPeriod && !loading && !error && !empty

  const fileStem = `звіт-харчування-${from === initialFrom && to === initialTo ? toMonthValue() : `${from}_${to}`}`

  const download = async (format: 'docx' | 'pdf') => {
    setBusy(format)
    try {
      // Бібліотеки документів важкі — вантажимо їх лише зараз.
      const blob =
        format === 'docx'
          ? await (await import('@/lib/reportDocx')).docxBlob(model)
          : await (await import('@/lib/reportPdf')).pdfBlob(model)
      downloadBlob(blob, `${fileStem}.${format}`)
    } catch (err) {
      toast.error(humanError(err, 'Не вдалося сформувати документ.'))
    } finally {
      setBusy(null)
    }
  }

  const setMonth = (month: string) => {
    const [start, end] = monthValueBounds(month)
    setFrom(start)
    setTo(end)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Звіт про організацію харчування"
        description="Документ на затвердження директором: загальні дані, групи класів, відвідування, пільгові категорії."
        actions={
          <>
            <Button size="sm" variant="outline" disabled={!ready || busy !== null} onClick={() => void download('docx')}>
              <FileDown className="size-4" aria-hidden />
              {busy === 'docx' ? 'Формуємо…' : 'Завантажити DOCX'}
            </Button>
            <Button size="sm" disabled={!ready || busy !== null} onClick={() => void download('pdf')}>
              <FileDown className="size-4" aria-hidden />
              {busy === 'pdf' ? 'Формуємо…' : 'Завантажити PDF'}
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-2">
          <Label htmlFor="org-from">З дати</Label>
          <Input id="org-from" type="date" className="w-44" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="org-to">По дату</Label>
          <Input id="org-to" type="date" className="w-44" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <Button variant="ghost" size="sm" onClick={() => setMonth(toMonthValue())}>
          Цей місяць
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setMonth(previousMonth())}>
          Минулий місяць
        </Button>
      </div>

      {!validPeriod ? (
        <ErrorState error={new Error('Дата початку має бути не пізніше за дату кінця.')} />
      ) : null}

      {reportSettingsQuery.data !== undefined && !hasDirector ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>Ім’я директора не вказано</AlertTitle>
          <AlertDescription>
            У шапці «ЗАТВЕРДЖУЮ» буде лише лінія для підпису. Вказати можна в{' '}
            <Link to="/school-settings" className="underline underline-offset-4">
              налаштуваннях школи
            </Link>
            .
          </AlertDescription>
        </Alert>
      ) : null}

      {ready && report.unpricedOrders > 0 ? (
        <Alert>
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>Вартість неповна</AlertTitle>
          <AlertDescription>
            {report.unpricedOrders} {plural(report.unpricedOrders, 'замовлення', 'замовлення', 'замовлень')}{' '}
            зроблено на дні без вказаної вартості блюда — вони додають до сум нуль.
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? <LoadingState /> : null}
      {error ? <ErrorState error={error} /> : null}
      {empty ? <EmptyState title="За цей період замовлень немає" hint="Оберіть інший період." /> : null}

      {ready ? (
        <div className="space-y-6 rounded-lg border p-4 sm:p-6">
          <div className="ml-auto w-fit space-y-1 text-sm">
            {model.approval.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <div className="text-center">
            <p className="font-semibold">{model.title}</p>
            <p className="text-sm">{periodLabel(from, to)}</p>
          </div>
          {model.sections.map((section) => (
            <section key={section.heading} className="space-y-2">
              <h2 className="text-sm font-semibold">{section.heading}</h2>
              <PreviewTable table={section.table} />
              {section.note ? <p className="text-xs text-muted-foreground">{section.note}</p> : null}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function PreviewTable({ table }: { table: DocTable }) {
  const alignClass = (i: number) =>
    table.columns[i].align === 'right' ? 'text-right tabular-nums' : table.columns[i].align === 'center' ? 'text-center' : ''
  return (
    <div className="overflow-x-auto rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            {table.columns.map((column, i) => (
              <TableHead key={column.header} className={cn(alignClass(i), 'whitespace-normal')}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {table.rows.map((row, r) => (
            <TableRow key={r}>
              {row.map((text, i) => (
                <TableCell key={i} className={alignClass(i)}>
                  {text}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        {table.total ? (
          <TableFooter>
            <TableRow>
              {table.total.map((text, i) => (
                <TableCell key={i} className={cn(alignClass(i), 'font-medium')}>
                  {text}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        ) : null}
      </Table>
    </div>
  )
}
