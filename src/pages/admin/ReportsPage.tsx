import { Link } from 'react-router-dom'
import {
  CalendarCheck,
  ChartPie,
  Clock,
  Receipt,
  Star,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/common/PageHeader'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface ReportLink {
  to: string
  title: string
  description: string
  audience: string
  icon: LucideIcon
}

/**
 * Вітрина звітів. Кожен звіт — окремий екран з власними параметрами, а
 * тут лише коротко сказано, що всередині й кому це зазвичай потрібно:
 * інакше розділ швидко перетворюється на звалище таблиць.
 */
const REPORTS: ReportLink[] = [
  {
    to: '/reports/reimbursement',
    title: 'Звіт про відшкодування',
    description:
      'Порції та їхня собівартість за місяць по класах, окремо пільгові й звичайні.',
    audience: 'Бухгалтерія, щомісяця',
    icon: Receipt,
  },
  {
    to: '/reports/timesheet',
    title: 'Табель харчування',
    description: 'Сітка «учень × дні місяця» з підсумком днів і суми по кожному учню.',
    audience: 'Класний керівник, бухгалтерія',
    icon: CalendarCheck,
  },
  {
    to: '/reports/coverage',
    title: 'Охоплення харчуванням',
    description: 'Скільки дітей харчується і як часто замовляють — по класах за місяць.',
    audience: 'Управління освіти, директор',
    icon: ChartPie,
  },
  {
    to: '/reports/privileged',
    title: 'Пільгові учні',
    description: 'Хто має пільгу, на якій підставі, хто і коли поставив статус.',
    audience: 'Перевірки',
    icon: Star,
  },
  {
    to: '/reports/late',
    title: 'Пізні замовлення',
    description: 'Що додали після дедлайну — понад аркуш, за яким готувала кухня.',
    audience: 'Внутрішній контроль, їдальня',
    icon: Clock,
  },
]

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Звіти"
        description="Кожен звіт друкується й вивантажується в CSV, який Excel відкриває без майстра імпорту."
      />

      <div className="grid gap-4 md:grid-cols-2">
        {REPORTS.map((report) => (
          <Card key={report.to} className="transition-colors hover:bg-muted/40">
            <Link to={report.to} className="block">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <report.icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <div>
                    <CardTitle className="text-base">{report.title}</CardTitle>
                    <CardDescription>{report.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {report.audience}
                </p>
              </CardContent>
            </Link>
          </Card>
        ))}
      </div>
    </div>
  )
}
