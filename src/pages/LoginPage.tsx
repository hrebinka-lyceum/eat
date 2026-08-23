import { useState, type FormEvent } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { UtensilsCrossed } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { HOME_BY_ROLE } from '@/nav'
import { humanError } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/common/states'

export default function LoginPage() {
  const { userId, role, loading, mustChangePassword, signIn } = useAuth()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && userId && role) {
    if (mustChangePassword) return <Navigate to="/change-password" replace />
    const from = (location.state as { from?: string } | null)?.from
    return <Navigate to={from && from !== '/login' ? from : HOME_BY_ROLE[role]} replace />
  }

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      // Пароль живе лише в полі форми і йде прямо в Supabase.
      await signIn(email.trim(), password)
    } catch (err) {
      setError(humanError(err, 'Не вдалося увійти.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <UtensilsCrossed className="size-5" aria-hidden />
            <span className="text-sm">Шкільне харчування</span>
          </div>
          <CardTitle>Вхід</CardTitle>
          <CardDescription>Введіть логін і пароль, які вам видали в школі.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="email">Логін</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                required
                placeholder="petrenko.o@school.local"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? <ErrorState error={new Error(error)} /> : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Входимо…' : 'Увійти'}
            </Button>

            {/* Логіни синтетичні, пошта на них не ходить: відновлення через
                email тут — тупик, тому й не пропонуємо. */}
            <p className="text-center text-sm text-muted-foreground">
              Забули пароль — зверніться до класного керівника або адміністратора.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
