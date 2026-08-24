import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { LogOut, UtensilsCrossed } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { GROUP_LABELS, navFor, type NavItem } from '@/nav'
import { ROLE_LABELS } from '@/lib/format'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

function groupItems(items: NavItem[]) {
  const groups: Array<[NavItem['group'], NavItem[]]> = []
  for (const item of items) {
    const found = groups.find(([key]) => key === item.group)
    if (found) found[1].push(item)
    else groups.push([item.group, [item]])
  }
  return groups
}

/** Каркас для співробітників: бічне меню на широкому екрані, стрічка на вузькому. */
export function AppLayout() {
  const { profile, role, signOut } = useAuth()
  const navigate = useNavigate()
  const items = role ? navFor(role) : []

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
      isActive ? 'bg-accent font-medium text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60',
    )

  return (
    <div className="min-h-svh bg-background">
      <header
        data-print="hide"
        className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur"
      >
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2 font-semibold">
            <UtensilsCrossed className="size-5" aria-hidden />
            <span>Шкільне харчування</span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="max-w-[60vw] truncate">
                {profile?.full_name || 'Користувач'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="font-normal text-muted-foreground">
                {role ? ROLE_LABELS[role] : ''}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => void handleSignOut()}>
                <LogOut className="size-4" aria-hidden />
                Вийти
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Навігація на вузькому екрані */}
        <nav className="flex gap-1 overflow-x-auto border-t px-2 py-2 lg:hidden">
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} end className={linkClass}>
              <item.icon className="size-4 shrink-0" aria-hidden />
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <div className="flex">
        <aside data-print="hide" className="hidden w-64 shrink-0 border-r p-3 lg:block">
          <nav className="sticky top-20 space-y-4">
            {groupItems(items).map(([group, groupNav]) => (
              <div key={group}>
                <p className="px-3 pb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {GROUP_LABELS[group]}
                </p>
                <div className="space-y-0.5">
                  {groupNav.map((item) => (
                    <NavLink key={item.to} to={item.to} end className={linkClass}>
                      <item.icon className="size-4 shrink-0" aria-hidden />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        <main className="min-w-0 flex-1 p-4 lg:p-6">
          <div className="mx-auto max-w-6xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
