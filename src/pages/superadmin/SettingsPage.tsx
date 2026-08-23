import { PhaseStub } from '@/components/common/PhaseStub'

export default function SettingsPage() {
  return (
    <PhaseStub
      title="Налаштування"
      description="Дедлайн, навчальний рік, домен логінів."
      phase={6}
      plan={[
        'cutoff_time і cutoff_days_before',
        'current_year — має точно збігатися з academic_year класів',
        'login_domain',
      ]}
    />
  )
}
