import { useCallback, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { createStaff, issueLogins, resetPassword } from '@/api/accounts'
import { humanError } from '@/lib/errors'
import type { Credential } from '@/components/common/CredentialsDialog'
import type { UserRole } from '@/types/database'

interface Skipped {
  name: string
  reason: string
}

/**
 * Спільна логіка всіх дій з акаунтами.
 *
 * Паролі свідомо тримаються тільки тут, у стані екрана, і зникають, щойно
 * вікно закривають. Через react-query вони не проходять навмисно: кеш
 * пережив би закриття вікна, а сервер віддає пароль лише один раз.
 */
/**
 * Edge Function повертає повну адресу (petrenko.o@school.local), а входять
 * тепер за логіном — тією частиною, що до «@». Видаємо саме її, щоб
 * людині не доводилося вгадувати, що з написаного вводити.
 */
function loginPart(email: string): string {
  return email.split('@')[0]
}

export function useCredentialsFlow() {
  const queryClient = useQueryClient()
  const [credentials, setCredentials] = useState<Credential[] | null>(null)
  const [skipped, setSkipped] = useState<Skipped[]>([])
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const close = useCallback(() => {
    setCredentials(null)
    setSkipped([])
    setTitle('')
  }, [])

  const issue = useCallback(
    async (studentIds: string[], nameById: Map<string, string>) => {
      setBusy(true)
      try {
        const result = await issueLogins(studentIds)
        await queryClient.invalidateQueries({ queryKey: ['students'] })

        if (result.issued.length === 0) {
          toast.error('Жодного логіна не видано')
        }
        setSkipped(
          result.skipped.map((item) => ({
            name: nameById.get(item.student_id) ?? 'Учень',
            reason: item.reason,
          })),
        )
        if (result.issued.length > 0) {
          setTitle(`Видано логінів: ${result.issued.length}`)
          setCredentials(
            result.issued.map((item) => ({
              full_name: item.full_name,
              login: loginPart(item.login),
              password: item.password,
            })),
          )
        } else if (result.skipped.length > 0) {
          toast.error(result.skipped[0].reason)
          setSkipped([])
        }
      } catch (error) {
        toast.error(humanError(error))
      } finally {
        setBusy(false)
      }
    },
    [queryClient],
  )

  const reset = useCallback(
    async (profileId: string, login?: string) => {
      setBusy(true)
      try {
        const result = await resetPassword(profileId)
        setTitle('Пароль скинуто')
        setCredentials([
          {
            full_name: result.full_name,
            login: login ?? '—',
            password: result.password,
          },
        ])
      } catch (error) {
        toast.error(humanError(error))
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const addStaff = useCallback(
    async (
      fullName: string,
      role: Exclude<UserRole, 'superadmin' | 'student'>,
      classId?: string,
    ) => {
      setBusy(true)
      try {
        const result = await createStaff(fullName, role, classId)
        await queryClient.invalidateQueries({ queryKey: ['profiles'] })
        await queryClient.invalidateQueries({ queryKey: ['classes'] })
        setTitle('Співробітника створено')
        setCredentials([
          {
            full_name: result.full_name,
            login: loginPart(result.login),
            password: result.password,
          },
        ])
        return true
      } catch (error) {
        toast.error(humanError(error))
        return false
      } finally {
        setBusy(false)
      }
    },
    [queryClient],
  )

  return { credentials, skipped, title, busy, issue, reset, addStaff, close }
}
