import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { History, LogOut, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/me', label: 'Меню', icon: UtensilsCrossed },
  { to: '/me/history', label: 'Мої замовлення', icon: History },
]

/**
 * Екран учня — окремий інтерфейс під телефон, а не зменшена адмінка.
 * Великі зони дотику, дві вкладки внизу, жодних цифр про гроші.
 */
export function StudentLayout() {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur">
        <span className="truncate font-medium">{profile?.full_name || 'Учень'}</span>
        <Button variant="ghost" size="icon" aria-label="Вийти" onClick={() => void handleSignOut()}>
          <LogOut className="size-5" aria-hidden />
        </Button>
      </header>

      <main className="flex-1 px-4 pb-24 pt-4">
        <div className="mx-auto max-w-md">
          <Outlet />
        </div>
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-2 border-t bg-background">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 text-xs',
                isActive ? 'font-medium text-foreground' : 'text-muted-foreground',
              )
            }
          >
            <tab.icon className="size-5" aria-hidden />
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
