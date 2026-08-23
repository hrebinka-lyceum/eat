import { useAuth } from './AuthContext'
import type { UserRole } from '@/types/database'

/**
 * Хто має право бачити вартість. Дзеркалить can_see_cost() у базі.
 *
 * Для представлень це лише зручність: сервер і так віддає total_cost як null
 * учневі та класному керівнику. А от dishes.price і menu_items.price
 * доступні на читання всім, тож на екранах цих ролей ціну не має
 * запитувати й показувати сам фронтенд.
 */
export function canSeeCost(role: UserRole | null): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'cafeteria'
}

export function useCanSeeCost(): boolean {
  const { role } = useAuth()
  return canSeeCost(role)
}

/** Хто редагує меню та довідник страв. */
export function canEditMenu(role: UserRole | null): boolean {
  return role === 'superadmin' || role === 'admin' || role === 'cafeteria'
}
