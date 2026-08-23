import { Link } from 'react-router-dom'
import { useAuth } from '@/auth/AuthContext'
import { HOME_BY_ROLE } from '@/nav'
import { Button } from '@/components/ui/button'

export default function NotFoundPage() {
  const { role } = useAuth()
  return (
    <div className="grid min-h-svh place-items-center p-6 text-center">
      <div className="space-y-3">
        <p className="text-lg font-medium">Такої сторінки немає</p>
        <p className="text-sm text-muted-foreground">
          Можливо, посилання застаріло або ви не маєте доступу до цього розділу.
        </p>
        <Button asChild>
          <Link to={role ? HOME_BY_ROLE[role] : '/login'}>На головну</Link>
        </Button>
      </div>
    </div>
  )
}
