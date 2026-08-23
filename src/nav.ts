import {
  CalendarDays,
  ChartColumn,
  ClipboardList,
  CookingPot,
  FileText,
  GraduationCap,
  History,
  Search,
  Settings,
  ShieldAlert,
  Trash2,
  UsersRound,
  UtensilsCrossed,
} from 'lucide-react'
import type { UserRole } from '@/types/database'

export interface NavItem {
  to: string
  label: string
  icon: typeof CalendarDays
  roles: UserRole[]
  /** Розділ навігації, щоб довгий список адміністратора не був суцільним */
  group: 'work' | 'school' | 'system'
}

/**
 * Пункти меню за ролями. Це зручність, а не захист: недоступну дію
 * все одно зупинить RLS на сервері.
 */
export const NAV_ITEMS: NavItem[] = [
  // --- Класний керівник -----------------------------------------------------
  { to: '/class', label: 'Мій клас', icon: UsersRound, roles: ['teacher'], group: 'work' },
  {
    to: '/class/orders',
    label: 'Замовлення класу',
    icon: ClipboardList,
    roles: ['teacher'],
    group: 'work',
  },
  { to: '/class/menu', label: 'Меню', icon: CalendarDays, roles: ['teacher'], group: 'work' },
  {
    to: '/class/dashboard',
    label: 'Дашборд класу',
    icon: ChartColumn,
    roles: ['teacher'],
    group: 'work',
  },

  // --- Їдальня та адміністрація --------------------------------------------
  {
    to: '/kitchen',
    label: 'Порції на день',
    icon: CookingPot,
    roles: ['cafeteria', 'admin', 'superadmin'],
    group: 'work',
  },
  {
    to: '/menu',
    label: 'Редактор меню',
    icon: CalendarDays,
    roles: ['cafeteria', 'admin', 'superadmin'],
    group: 'work',
  },
  {
    to: '/dishes',
    label: 'Довідник страв',
    icon: UtensilsCrossed,
    roles: ['cafeteria', 'admin', 'superadmin'],
    group: 'work',
  },

  // --- Школа ----------------------------------------------------------------
  {
    to: '/dashboard',
    label: 'Дашборд школи',
    icon: ChartColumn,
    roles: ['admin', 'superadmin'],
    group: 'school',
  },
  {
    to: '/search',
    label: 'Пошук учня',
    icon: Search,
    roles: ['admin', 'superadmin'],
    group: 'school',
  },
  {
    to: '/classes',
    label: 'Класи',
    icon: GraduationCap,
    roles: ['admin', 'superadmin'],
    group: 'school',
  },
  {
    to: '/reports',
    label: 'Звіти',
    icon: FileText,
    roles: ['admin', 'superadmin'],
    group: 'school',
  },

  // --- Системне (суперадмін) ------------------------------------------------
  { to: '/users', label: 'Користувачі', icon: UsersRound, roles: ['superadmin'], group: 'system' },
  { to: '/settings', label: 'Налаштування', icon: Settings, roles: ['superadmin'], group: 'system' },
  {
    to: '/year',
    label: 'Переведення року',
    icon: ShieldAlert,
    roles: ['superadmin'],
    group: 'system',
  },
  { to: '/purge', label: 'Видалення даних', icon: Trash2, roles: ['superadmin'], group: 'system' },
  {
    to: '/purge-log',
    label: 'Журнал видалень',
    icon: History,
    roles: ['superadmin'],
    group: 'system',
  },
]

export const GROUP_LABELS: Record<NavItem['group'], string> = {
  work: 'Робота',
  school: 'Школа',
  system: 'Адміністрування',
}

/** Куди веде вхід для кожної ролі. */
export const HOME_BY_ROLE: Record<UserRole, string> = {
  student: '/me',
  teacher: '/class',
  cafeteria: '/kitchen',
  admin: '/dashboard',
  superadmin: '/dashboard',
}

export function navFor(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role))
}
