import { useQuery } from '@tanstack/react-query'
import { listMenuDays } from '@/api/menu'
import { qk } from '@/lib/queryKeys'
import { shiftIso } from '@/lib/dates'
import { toIsoDate } from '@/lib/format'

const DAYS_AHEAD = 13

/**
 * Опубліковані дні на найближчі два тижні.
 *
 * Керівник працює лише з ними: на неопублікований день замовлення однаково
 * не пройде — is_before_cutoff() у базі вимагає published.
 */
export function usePublishedDays() {
  const from = toIsoDate()
  const to = shiftIso(from, DAYS_AHEAD)

  const query = useQuery({
    queryKey: qk.menuDays(from, to, 'published'),
    queryFn: () => listMenuDays(from, to, { status: 'published' }),
  })

  return {
    days: query.data ?? [],
    isPending: query.isLoading,
    error: query.error,
  }
}
