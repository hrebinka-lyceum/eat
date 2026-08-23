import { Hammer } from 'lucide-react'
import { PageHeader } from './PageHeader'

/**
 * Заглушка екрана, який з'явиться в наступних фазах. Каркас має бути
 * пройденим наскрізь: маршрут, права й навігація вже справжні, зміст — ні.
 */
export function PhaseStub({
  title,
  description,
  phase,
  plan,
}: {
  title: string
  description?: string
  phase: number
  plan: string[]
}) {
  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />
      <div className="rounded-lg border bg-muted/30 p-6">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Hammer className="size-4" aria-hidden />
          Екран у роботі — Фаза {phase}
        </div>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {plan.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
