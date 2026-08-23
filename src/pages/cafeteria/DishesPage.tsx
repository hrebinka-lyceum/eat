import { PhaseStub } from '@/components/common/PhaseStub'

export default function DishesPage() {
  return (
    <PhaseStub
      title="Довідник страв"
      description="Назва, категорія, ціна, активність."
      phase={2}
      plan={[
        'CRUD страв',
        'Ціна — собівартість порції для школи',
        'Неактивні страви лишаються заради історії меню',
      ]}
    />
  )
}
