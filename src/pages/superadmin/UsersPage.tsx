import { PhaseStub } from '@/components/common/PhaseStub'

export default function UsersPage() {
  return (
    <PhaseStub
      title="Користувачі"
      description="Співробітники та їхні ролі."
      phase={4}
      plan={[
        'Створення співробітника через Edge Function accounts',
        'Пароль показується рівно один раз: копіювання і CSV',
        'Зміна ролі та деактивація',
        'Скидання пароля',
      ]}
    />
  )
}
