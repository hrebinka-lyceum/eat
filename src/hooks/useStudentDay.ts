import { useQuery } from '@tanstack/react-query'
import { areOrdersOpen, getNextPublishedDay, listMenuItemsPlain } from '@/api/menu'
import { getOrderPlain } from '@/api/orders'
import { qk } from '@/lib/queryKeys'
import { useMyStudent } from './useMyStudent'

/**
 * Усе, що потрібно екрану учня: його картка, найближчий опублікований день,
 * склад меню без цін, власне замовлення на цей день і відповідь сервера про
 * те, чи ще приймаються замовлення.
 */
export function useStudentDay() {
  const { student, isPending: studentPending, error: studentError } = useMyStudent()

  const dayQuery = useQuery({
    queryKey: qk.nextPublishedDay(),
    queryFn: () => getNextPublishedDay(),
  })

  const menuDate = dayQuery.data?.menu_date ?? null

  const itemsQuery = useQuery({
    queryKey: qk.menuItemsPlain(menuDate ?? ''),
    queryFn: () => listMenuItemsPlain(menuDate!),
    enabled: Boolean(menuDate),
  })

  const orderQuery = useQuery({
    queryKey: qk.orderOfStudent(student?.id ?? '', menuDate ?? ''),
    queryFn: () => getOrderPlain(student!.id, menuDate!),
    enabled: Boolean(student) && Boolean(menuDate),
  })

  // Дедлайн вирішує сервер. Тримаємо відповідь свіжою, але не робимо з неї
  // таймер: якщо час мине між перевіркою і натисканням, place_order відмовить.
  const openQuery = useQuery({
    queryKey: qk.ordersOpen(menuDate ?? ''),
    queryFn: () => areOrdersOpen(menuDate!),
    enabled: Boolean(menuDate),
    staleTime: 60_000,
  })

  return {
    student,
    day: dayQuery.data ?? null,
    items: itemsQuery.data ?? [],
    order: orderQuery.data ?? null,
    /** true — відкрито, false — час минув, null — сервер не відповів */
    ordersOpen: openQuery.data ?? null,
    // isLoading, а не isPending: вимкнений запит (немає картки учня або
    // немає опублікованого дня) назавжди лишається pending, і екран завис би
    // на «Завантаження…» замість пояснення, що відбувається.
    isPending:
      studentPending || dayQuery.isLoading || itemsQuery.isLoading || orderQuery.isLoading,
    error: studentError ?? dayQuery.error ?? itemsQuery.error ?? orderQuery.error,
  }
}
