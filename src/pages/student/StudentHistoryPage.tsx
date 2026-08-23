import { PhaseStub } from '@/components/common/PhaseStub'

export default function StudentHistoryPage() {
  return (
    <PhaseStub
      title="Мої замовлення"
      description="Історія власних замовлень, лише для читання."
      phase={3}
      plan={[
        'Список днів із складом замовлення',
        'Без сум і без можливості змінити',
      ]}
    />
  )
}
