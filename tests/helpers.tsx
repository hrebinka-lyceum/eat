import type { ReactElement, ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { render } from '@testing-library/react'
import { AuthContext, type AuthState } from '@/auth/AuthContext'
import type { Profile, UserRole } from '@/types/database'

/** Тихий клієнт: без повторів і без фонових оновлень, щоб тест був детермінованим. */
export function testQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnMount: false, refetchOnWindowFocus: false, gcTime: 0 },
      mutations: { retry: false },
    },
  })
}

export function fakeAuth(role: UserRole, over: Partial<AuthState> = {}): AuthState {
  const profile: Profile = {
    id: 'u1',
    role,
    status: 'active',
    full_name: 'Тест Тестовий',
    must_change_password: false,
    created_at: '2026-09-01T00:00:00Z',
  }
  return {
    loading: false,
    userId: 'u1',
    profile,
    role,
    mustChangePassword: false,
    signIn: async () => {},
    signOut: async () => {},
    refreshProfile: async () => {},
    ...over,
  }
}

export function renderWithProviders(
  ui: ReactElement,
  { role = 'student' as UserRole, auth = fakeAuth(role), route = '/' } = {},
) {
  const client = testQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>
  )
  return { client, ...render(ui, { wrapper }) }
}

/** Чи є на екрані бодай натяк на гроші. */
export function hasMoney(container: HTMLElement): boolean {
  const text = container.textContent ?? ''
  return /грн|₴|Вартість|Сума|Ціна/i.test(text)
}
