import { createContext, useContext } from 'react'
import type { Profile, UserRole } from '@/types/database'

export interface AuthState {
  /** true, поки не з'ясовано, чи є сесія і хто це */
  loading: boolean
  userId: string | null
  profile: Profile | null
  role: UserRole | null
  /** Профіль вимагає зміни пароля — до неї не пускаємо нікуди */
  mustChangePassword: boolean
  /** Приймає логін (або стару пошту) і пароль */
  signIn: (login: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth використано поза AuthProvider')
  return ctx
}
