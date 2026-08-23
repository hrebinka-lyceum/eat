import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { KeyRound, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { listStaff, setRole, setStatus } from '@/api/profiles'
import { listClasses } from '@/api/classes'
import { getSettings } from '@/api/settings'
import { useAuth } from '@/auth/AuthContext'
import { useCredentialsFlow } from '@/hooks/useCredentialsFlow'
import { qk } from '@/lib/queryKeys'
import { humanError } from '@/lib/errors'
import { csvFilename } from '@/lib/csv'
import { ROLE_LABELS } from '@/lib/format'
import { PageHeader } from '@/components/common/PageHeader'
import { ExportButton } from '@/components/common/ExportButton'
import { CredentialsDialog } from '@/components/common/CredentialsDialog'
import { EmptyState, ErrorState, LoadingState } from '@/components/common/states'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CreateStaffDialog } from './components/CreateStaffDialog'
import type { Profile, UserRole } from '@/types/database'

const ASSIGNABLE_ROLES: UserRole[] = ['superadmin', 'admin', 'cafeteria', 'teacher']

/** Співробітники: створення, ролі, деактивація, скидання паролів. */
export default function UsersPage() {
  const queryClient = useQueryClient()
  const { userId } = useAuth()
  const credentials = useCredentialsFlow()
  const [createOpen, setCreateOpen] = useState(false)

  const staffQuery = useQuery({ queryKey: ['profiles', 'staff'], queryFn: listStaff })
  const settingsQuery = useQuery({ queryKey: qk.settings(), queryFn: getSettings })
  const classesQuery = useQuery({
    queryKey: qk.classes(settingsQuery.data?.current_year),
    queryFn: () => listClasses(settingsQuery.data!.current_year),
    enabled: Boolean(settingsQuery.data),
  })

  const classByTeacher = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of classesQuery.data ?? []) {
      if (item.teacher_id) map.set(item.teacher_id, item.name)
    }
    return map
  }, [classesQuery.data])

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['profiles'] })

  const changeRole = useMutation({
    mutationFn: ({ profile, role }: { profile: Profile; role: UserRole }) =>
      setRole(profile.id, role),
    onSuccess: async () => {
      await invalidate()
      toast.success('Роль змінено')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const changeStatus = useMutation({
    mutationFn: ({ profile, active }: { profile: Profile; active: boolean }) =>
      setStatus(profile.id, active ? 'active' : 'disabled'),
    onSuccess: async (_data, variables) => {
      await invalidate()
      toast.success(variables.active ? 'Акаунт активовано' : 'Акаунт деактивовано')
    },
    onError: (err) => toast.error(humanError(err)),
  })

  const staff = staffQuery.data ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Користувачі"
        description="Співробітники школи. Учнівські акаунти видаються з реєстру класу."
        actions={
          <>
            <ExportButton
              rows={staff}
              filename={csvFilename('співробітники')}
              columns={[
                { header: 'ПІБ', value: (p) => p.full_name },
                { header: 'Роль', value: (p) => ROLE_LABELS[p.role] },
                { header: 'Клас', value: (p) => classByTeacher.get(p.id) ?? '' },
                { header: 'Активний', value: (p) => p.status === 'active' },
              ]}
            />
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="size-4" aria-hidden />
              Додати співробітника
            </Button>
          </>
        }
      />

      {staffQuery.isPending ? <LoadingState /> : null}
      {staffQuery.error ? <ErrorState error={staffQuery.error} /> : null}

      {staffQuery.data && staff.length === 0 ? (
        <EmptyState title="Співробітників ще немає" />
      ) : null}

      {staff.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ПІБ</TableHead>
                <TableHead className="w-56">Роль</TableHead>
                <TableHead>Клас</TableHead>
                <TableHead>Активний</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {staff.map((profile) => {
                const isSelf = profile.id === userId
                return (
                  <TableRow key={profile.id}>
                    <TableCell className="font-medium">
                      {profile.full_name || 'Без імені'}
                      {isSelf ? (
                        <Badge variant="secondary" className="ml-2">
                          це ви
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {/* Власну роль змінити не можна: інакше суперадмін
                          здатен випадково відібрати доступ сам у себе. */}
                      <Select
                        value={profile.role}
                        disabled={isSelf || changeRole.isPending}
                        onValueChange={(value) =>
                          changeRole.mutate({ profile, role: value as UserRole })
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASSIGNABLE_ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      {profile.role === 'teacher' ? (
                        (classByTeacher.get(profile.id) ?? (
                          <span className="text-muted-foreground">без класу</span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={profile.status === 'active'}
                        disabled={isSelf || changeStatus.isPending}
                        aria-label={`Активність акаунта ${profile.full_name}`}
                        onCheckedChange={(active) => changeStatus.mutate({ profile, active })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={credentials.busy}
                        onClick={() => void credentials.reset(profile.id)}
                      >
                        <KeyRound className="size-4" aria-hidden />
                        Скинути пароль
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      ) : null}

      <CreateStaffDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        busy={credentials.busy}
        onCreate={credentials.addStaff}
      />

      <CredentialsDialog
        credentials={credentials.credentials}
        title={credentials.title}
        onClose={credentials.close}
      />
    </div>
  )
}
