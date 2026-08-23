import { useQuery } from '@tanstack/react-query'
import { getSettings } from '@/api/settings'
import { getClassOfTeacher } from '@/api/classes'
import { useAuth } from '@/auth/AuthContext'
import { qk } from '@/lib/queryKeys'

/**
 * Клас, яким керує поточний користувач.
 *
 * Рахується так само, як auth_class_id() у базі: за teacher_id і поточним
 * навчальним роком із settings. Якщо ці два джерела розійдуться, керівник
 * залишиться без класу — і тут це видно як явний стан, а не як порожній
 * список без пояснень.
 */
export function useMyClass() {
  const { userId } = useAuth()

  const settingsQuery = useQuery({
    queryKey: qk.settings(),
    queryFn: getSettings,
    staleTime: 5 * 60_000,
  })

  const classQuery = useQuery({
    queryKey: qk.myClass(userId ?? ''),
    queryFn: () => getClassOfTeacher(userId!, settingsQuery.data!.current_year),
    enabled: Boolean(userId) && Boolean(settingsQuery.data),
  })

  return {
    myClass: classQuery.data ?? null,
    currentYear: settingsQuery.data?.current_year ?? null,
    isPending: settingsQuery.isLoading || classQuery.isLoading,
    error: settingsQuery.error ?? classQuery.error,
  }
}
