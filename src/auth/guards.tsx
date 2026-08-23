import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { HOME_BY_ROLE } from '@/nav'
import { LoadingState } from '@/components/common/states'
import type { UserRole } from '@/types/database'

function FullScreenLoading() {
  return (
    <div className="grid min-h-svh place-items-center">
      <LoadingState />
    </div>
  )
}

/** Пускає лише автентифікованих; примусову зміну пароля обійти не можна. */
export function RequireAuth() {
  const { loading, userId, profile, mustChangePassword } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoading />
  if (!userId) return <Navigate to="/login" replace state={{ from: location.pathname }} />

  if (!profile) {
    return (
      <div className="grid min-h-svh place-items-center p-6 text-center">
        <div className="max-w-sm space-y-2">
          <p className="font-medium">Профіль недоступний</p>
          <p className="text-sm text-muted-foreground">
            Акаунт існує, але профіль не читається. Зверніться до адміністратора.
          </p>
        </div>
      </div>
    )
  }

  if (mustChangePassword && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />
  }

  return <Outlet />
}

/** Приховує чужі екрани. Справжній захист — RLS, це лише зручність. */
export function RequireRole({ roles }: { roles: UserRole[] }) {
  const { role } = useAuth()
  if (!role) return <FullScreenLoading />
  if (!roles.includes(role)) return <Navigate to={HOME_BY_ROLE[role]} replace />
  return <Outlet />
}

/** Кожна роль має власну домівку. */
export function RoleHome() {
  const { loading, role } = useAuth()
  if (loading) return <FullScreenLoading />
  if (!role) return <Navigate to="/login" replace />
  return <Navigate to={HOME_BY_ROLE[role]} replace />
}
