import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as authApi from '@/api/auth'
import { getProfile } from '@/api/profiles'
import { AuthContext, type AuthState } from './AuthContext'
import type { Profile } from '@/types/database'

/**
 * Сесія та профіль поточного користувача.
 *
 * Роль з profiles.role потрібна лише для маршрутизації й приховування
 * недоступного. Реальні права забезпечує RLS: якщо користувач якось
 * викличе недоступну дію, сервер поверне помилку — і це нормально.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const userIdRef = useRef<string | null>(null)

  const loadProfile = useCallback(async (id: string) => {
    const loaded = await getProfile(id)

    // Деактивований акаунт далі не пускаємо: RLS для нього однаково порожня.
    if (loaded && loaded.status === 'disabled') {
      await authApi.signOut()
      throw new Error('Акаунт деактивовано. Зверніться до адміністратора.')
    }
    setProfile(loaded)
  }, [])

  useEffect(() => {
    let cancelled = false

    const apply = async (id: string | null) => {
      if (cancelled) return
      if (userIdRef.current === id && id !== null) {
        setLoading(false)
        return
      }
      userIdRef.current = id
      setUserId(id)

      if (!id) {
        setProfile(null)
        setLoading(false)
        return
      }
      try {
        await loadProfile(id)
      } catch {
        userIdRef.current = null
        setUserId(null)
        setProfile(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    authApi.getSession().then((session) => apply(session?.user.id ?? null))
    const unsubscribe = authApi.onAuthStateChange((session) => {
      void apply(session?.user.id ?? null)
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [loadProfile])

  const signIn = useCallback(
    async (email: string, password: string) => {
      const session = await authApi.signIn(email, password)
      userIdRef.current = session.user.id
      setUserId(session.user.id)
      await loadProfile(session.user.id)
      setLoading(false)
    },
    [loadProfile],
  )

  const signOut = useCallback(async () => {
    await authApi.signOut()
    userIdRef.current = null
    setUserId(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (userIdRef.current) await loadProfile(userIdRef.current)
  }, [loadProfile])

  const value = useMemo<AuthState>(
    () => ({
      loading,
      userId,
      profile,
      role: profile?.role ?? null,
      mustChangePassword: profile?.must_change_password === true,
      signIn,
      signOut,
      refreshProfile,
    }),
    [loading, userId, profile, signIn, signOut, refreshProfile],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
