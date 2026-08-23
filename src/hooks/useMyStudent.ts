import { useQuery } from '@tanstack/react-query'
import { getStudentByProfile } from '@/api/students'
import { useAuth } from '@/auth/AuthContext'
import { qk } from '@/lib/queryKeys'

/** Картка учня, прив'язана до цього акаунта. */
export function useMyStudent() {
  const { userId } = useAuth()

  const query = useQuery({
    queryKey: qk.myStudent(userId ?? ''),
    queryFn: () => getStudentByProfile(userId!),
    enabled: Boolean(userId),
  })

  return {
    student: query.data ?? null,
    isPending: query.isLoading,
    error: query.error,
  }
}
