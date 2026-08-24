import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { KeyRound } from 'lucide-react'
import { useAuth } from '@/auth/AuthContext'
import { HOME_BY_ROLE } from '@/nav'
import { changePassword } from '@/api/auth'
import { clearMustChangePassword } from '@/api/profiles'
import { humanError } from '@/lib/errors'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/common/PasswordInput'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ErrorState } from '@/components/common/states'

const MIN_LENGTH = 8

/**
 * Блокуючий екран одразу після входу, поки profiles.must_change_password.
 * Новий пароль ніде не зберігається: він живе в полі форми до відправки.
 */
export default function ChangePasswordPage() {
  const { userId, role, loading, mustChangePassword, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (loading) return null
  if (!userId) return <Navigate to="/login" replace />
  if (!mustChangePassword && role) return <Navigate to={HOME_BY_ROLE[role]} replace />

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password.length < MIN_LENGTH) {
      setError(`Пароль має містити щонайменше ${MIN_LENGTH} символів.`)
      return
    }
    if (password !== repeat) {
      setError('Паролі не збігаються.')
      return
    }

    setBusy(true)
    try {
      await changePassword(password)
      await clearMustChangePassword(userId)
      await refreshProfile()
      setPassword('')
      setRepeat('')
      navigate(role ? HOME_BY_ROLE[role] : '/', { replace: true })
    } catch (err) {
      setError(humanError(err, 'Не вдалося змінити пароль.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-svh place-items-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-muted-foreground">
            <KeyRound className="size-5" aria-hidden />
            <span className="text-sm">Перший вхід</span>
          </div>
          <CardTitle>Змініть пароль</CardTitle>
          <CardDescription>
            Виданий пароль тимчасовий. Придумайте власний — далі система працюватиме з ним.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="new-password">Новий пароль</Label>
              <PasswordInput
                id="new-password"
                autoComplete="new-password"
                required
                value={password}
                onChange={setPassword}
              />
              <p className="text-xs text-muted-foreground">Щонайменше {MIN_LENGTH} символів.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="repeat-password">Повторіть пароль</Label>
              <PasswordInput
                id="repeat-password"
                autoComplete="new-password"
                required
                value={repeat}
                onChange={setRepeat}
              />
            </div>

            {error ? <ErrorState error={new Error(error)} /> : null}

            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? 'Зберігаємо…' : 'Зберегти пароль'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
