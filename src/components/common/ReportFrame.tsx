import { useEffect, useState, type ReactNode } from 'react'
import { Printer } from 'lucide-react'
import { readReportHeader, writeReportHeader } from '@/lib/reportHeader'
import { PageHeader } from './PageHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Спільний каркас звіту: параметри вгорі, шапка для підпису на папері,
 * таблиця всередині, друк і експорт поруч.
 *
 * Аркуші носять на підпис, тож у надрукованому вигляді потрібні назва
 * закладу, період і рядки «склав / перевірив» — на екрані вони тільки
 * заважали б, тому живуть під data-print.
 */
export function ReportFrame({
  title,
  description,
  periodLabel,
  params,
  actions,
  landscape = false,
  children,
}: {
  title: string
  description?: string
  /** Текст періоду у шапці друку: «вересень 2026» */
  periodLabel?: string
  params?: ReactNode
  actions?: ReactNode
  /** Широкі таблиці друкуються альбомно */
  landscape?: boolean
  children: ReactNode
}) {
  const [header, setHeader] = useState('')

  useEffect(() => {
    setHeader(readReportHeader())
  }, [])

  return (
    <div className="space-y-6" data-print="sheet">
      {/* @page діє на весь документ, тому стиль існує рівно поки
          відкритий цей звіт. */}
      {landscape ? <style>{'@page { size: landscape; margin: 10mm; }'}</style> : null}

      <PageHeader
        title={title}
        description={description}
        actions={
          <>
            {actions}
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" aria-hidden />
              Друк
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap items-end gap-3" data-print="hide">
        {params}
        <div className="min-w-56 flex-1 space-y-2">
          <Label htmlFor="report-header">Заголовок для друку</Label>
          <Input
            id="report-header"
            placeholder="Гребінківський ліцей"
            value={header}
            onChange={(e) => {
              setHeader(e.target.value)
              writeReportHeader(e.target.value)
            }}
          />
        </div>
      </div>

      {/* Шапка аркуша — лише на папері. Назву звіту не повторюємо:
          вона вже надрукована заголовком сторінки. */}
      <div className="hidden print:block">
        {header ? <p className="text-base font-semibold">{header}</p> : null}
        {periodLabel ? <p className="text-sm">{periodLabel}</p> : null}
      </div>

      {children}

      <div className="hidden pt-8 print:block">
        <div className="flex justify-between gap-12 text-sm">
          <span>Склав: ____________________</span>
          <span>Перевірив: ____________________</span>
        </div>
      </div>
    </div>
  )
}
