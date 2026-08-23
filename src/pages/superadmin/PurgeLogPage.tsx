import { PhaseStub } from '@/components/common/PhaseStub'

export default function PurgeLogPage() {
  return (
    <PhaseStub
      title="Журнал видалень"
      description="Слід незворотних операцій."
      phase={6}
      plan={[
        'Записи з purge_log: хто, коли, який період і категорії',
        'Експорт у CSV',
      ]}
    />
  )
}
