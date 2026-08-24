import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {/* Пояснення екрана на папері зайве: це підказка користувачу,
            а не частина документа. */}
        {description ? (
          <p className="mt-1 text-sm text-muted-foreground print:hidden">{description}</p>
        ) : null}
      </div>
      {/* Кнопки на папері не потрібні: на друк ідуть лише дані. */}
      {actions ? (
        <div data-print="hide" className="flex flex-wrap items-center gap-2">
          {actions}
        </div>
      ) : null}
    </div>
  )
}
