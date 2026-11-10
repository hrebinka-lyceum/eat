import { useQuery } from '@tanstack/react-query'
import { areOrdersOpen, getClassMenu, getNextPublishedDay } from '@/api/menu'
import { getOrderPlain } from '@/api/orders'
import { qk } from '@/lib/queryKeys'
import { useMyStudent } from './useMyStudent'

/**
 * Усе, що потрібно екрану учня: його картка, найближчий опублікований день,
 * склад меню його класу без цін (спеціального, якщо клас у ньому), власне
 * замовлення на цей день і відповідь сервера про те, чи ще приймаються замовлення.
 */
export function useStudentDay() {
  const { student, isPending: studentPending, error: studentError } = useMyStudent()

  const dayQuery = useQuery({
    queryKey: qk.nextPublishedDay(),
    queryFn: () => getNextPublishedDay(),
  })

  const menuDate = dayQuery.data?.menu_date ?? null

  const classId = student?.class_id ?? null

  const menuQuery = useQuery({
    queryKey: qk.classMenu(menuDate ?? '', classId ?? ''),
    queryFn: () => getClassMenu(menuDate!, classId!),
    enabled: Boolean(menuDate) && Boolean(classId),
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
    items: menuQuery.data?.items ?? [],
    /** спеціальне меню класу на цей день; null — основне */
    special: menuQuery.data?.special ?? null,
    order: orderQuery.data ?? null,
    /** true — відкрито, false — час минув, null — сервер не відповів */
    ordersOpen: openQuery.data ?? null,
    // isLoading, а не isPending: вимкнений запит (немає картки учня або
    // немає опублікованого дня) назавжди лишається pending, і екран завис би
    // на «Завантаження…» замість пояснення, що відбувається.
    isPending:
      studentPending || dayQuery.isLoading || menuQuery.isLoading || orderQuery.isLoading,
    error: studentError ?? dayQuery.error ?? menuQuery.error ?? orderQuery.error,
  }
}
