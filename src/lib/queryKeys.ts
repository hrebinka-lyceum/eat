/** Ключі кешу react-query в одному місці — щоб інвалідація не розповзалась. */
export const qk = {
  dishes: (includeInactive: boolean) => ['dishes', { includeInactive }] as const,
  menuDay: (date: string) => ['menu-day', date] as const,
  menuDays: (from: string, to: string, status?: string) =>
    ['menu-days', from, to, status ?? 'all'] as const,
  menuItems: (date: string) => ['menu-items', date] as const,
  menuItemsPlain: (date: string) => ['menu-items-plain', date] as const,
  menuItemsPlainForDates: (dates: string[]) => ['menu-items-plain', dates.join(',')] as const,
  nextEmptyDay: () => ['menu-next-empty'] as const,
  nextPublishedDay: () => ['menu-next-published'] as const,
  settings: () => ['settings'] as const,
  myClass: (teacherId: string) => ['my-class', teacherId] as const,
  myStudent: (profileId: string) => ['my-student', profileId] as const,
  ordersOpen: (date: string) => ['orders-open', date] as const,
  orderOfStudent: (studentId: string, date: string) => ['order', studentId, date] as const,
  ordersOfStudent: (studentId: string) => ['orders-of-student', studentId] as const,
  ordersOfClass: (classId: string, date: string) => ['orders-of-class', classId, date] as const,
  privilegeLog: (studentId: string) => ['privilege-log', studentId] as const,
  students: (classId: string, includeInactive = false) =>
    ['students', classId, { includeInactive }] as const,
  classes: (year?: string) => ['classes', year ?? 'all'] as const,
}
