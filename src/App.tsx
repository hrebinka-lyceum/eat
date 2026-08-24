import { Suspense, lazy } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/auth/AuthProvider'
import { RequireAuth, RequireRole, RoleHome } from '@/auth/guards'
import { AppLayout } from '@/components/layout/AppLayout'
import { StudentLayout } from '@/components/layout/StudentLayout'
import { Toaster } from '@/components/ui/sonner'
import { LoadingState } from '@/components/common/states'

import LoginPage from '@/pages/LoginPage'
import ChangePasswordPage from '@/pages/ChangePasswordPage'
import NotFoundPage from '@/pages/NotFoundPage'

import StudentMenuPage from '@/pages/student/StudentMenuPage'
import StudentConfirmPage from '@/pages/student/StudentConfirmPage'
import StudentHistoryPage from '@/pages/student/StudentHistoryPage'

import ClassRosterPage from '@/pages/teacher/ClassRosterPage'
import ClassOrdersPage from '@/pages/teacher/ClassOrdersPage'
import TeacherMenuPage from '@/pages/teacher/TeacherMenuPage'

import DishesPage from '@/pages/cafeteria/DishesPage'
import MenuEditorPage from '@/pages/cafeteria/MenuEditorPage'

import StudentSearchPage from '@/pages/admin/StudentSearchPage'
import ClassesPage from '@/pages/admin/ClassesPage'
import ReportsPage from '@/pages/admin/ReportsPage'

import ReimbursementReport from '@/pages/admin/reports/ReimbursementReport'
import TimesheetReport from '@/pages/admin/reports/TimesheetReport'
import CoverageReport from '@/pages/admin/reports/CoverageReport'
import PrivilegedReport from '@/pages/admin/reports/PrivilegedReport'
import LateOrdersReport from '@/pages/admin/reports/LateOrdersReport'

import UsersPage from '@/pages/superadmin/UsersPage'
import SettingsPage from '@/pages/superadmin/SettingsPage'
import PromoteYearPage from '@/pages/superadmin/PromoteYearPage'
import PurgePage from '@/pages/superadmin/PurgePage'
import PurgeLogPage from '@/pages/superadmin/PurgeLogPage'

// Екрани з графіками тягнуть за собою recharts — це майже половина
// бандла. Учневі, який відкриває меню з телефона, вона не потрібна,
// тож вантажимо її лише там, де справді малюємо графіки.
const PortionsPage = lazy(() => import('@/pages/cafeteria/PortionsPage'))
const SchoolDashboardPage = lazy(() => import('@/pages/admin/SchoolDashboardPage'))
const ClassDashboardPage = lazy(() => import('@/pages/teacher/ClassDashboardPage'))

// Той самий базовий шлях, що й у vite.config.ts. Розбіжність між ними
// дає білий екран без жодної помилки в консолі.
const BASENAME = import.meta.env.BASE_URL.replace(/\/$/, '')

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Помилку прав повторювати немає сенсу — вона не мине сама.
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

const STAFF_AND_TEACHER = ['teacher', 'cafeteria', 'admin', 'superadmin'] as const

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Тема зберігається в браузері під тим самим ключем, що читає
          скрипт в index.html, — щоб темна не блимала білим при старті. */}
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        storageKey="eat.theme"
        disableTransitionOnChange
      >
        <AuthProvider>
        <BrowserRouter basename={BASENAME}>
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<RequireAuth />}>
                <Route path="/change-password" element={<ChangePasswordPage />} />
                <Route path="/" element={<RoleHome />} />

                {/* Учень — окремий інтерфейс під телефон */}
                <Route element={<RequireRole roles={['student']} />}>
                  <Route element={<StudentLayout />}>
                    <Route path="/me" element={<StudentMenuPage />} />
                    <Route path="/me/confirm" element={<StudentConfirmPage />} />
                    <Route path="/me/history" element={<StudentHistoryPage />} />
                  </Route>
                </Route>

                {/* Співробітники */}
                <Route element={<RequireRole roles={[...STAFF_AND_TEACHER]} />}>
                  <Route element={<AppLayout />}>
                    <Route element={<RequireRole roles={['teacher']} />}>
                      <Route path="/class" element={<ClassRosterPage />} />
                      <Route path="/class/orders" element={<ClassOrdersPage />} />
                      <Route path="/class/menu" element={<TeacherMenuPage />} />
                      <Route path="/class/dashboard" element={<ClassDashboardPage />} />
                      {/* Табель свого класу — керівник заповнює його щомісяця
                          вручну, тож нехай бере готовий. Сум там немає. */}
                      <Route path="/class/timesheet" element={<TimesheetReport />} />
                    </Route>

                    <Route element={<RequireRole roles={['cafeteria', 'admin', 'superadmin']} />}>
                      <Route path="/kitchen" element={<PortionsPage />} />
                      <Route path="/menu" element={<MenuEditorPage />} />
                      <Route path="/dishes" element={<DishesPage />} />
                    </Route>

                    <Route element={<RequireRole roles={['admin', 'superadmin']} />}>
                      <Route path="/dashboard" element={<SchoolDashboardPage />} />
                      <Route path="/search" element={<StudentSearchPage />} />
                      <Route path="/classes" element={<ClassesPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/reports/reimbursement" element={<ReimbursementReport />} />
                      <Route path="/reports/timesheet" element={<TimesheetReport />} />
                      <Route path="/reports/coverage" element={<CoverageReport />} />
                      <Route path="/reports/privileged" element={<PrivilegedReport />} />
                      <Route path="/reports/late" element={<LateOrdersReport />} />
                    </Route>

                    <Route element={<RequireRole roles={['superadmin']} />}>
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/year" element={<PromoteYearPage />} />
                      <Route path="/purge" element={<PurgePage />} />
                      <Route path="/purge-log" element={<PurgeLogPage />} />
                    </Route>
                  </Route>
                </Route>
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
          <Toaster position="top-center" />
        </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
