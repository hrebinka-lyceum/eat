import { PhaseStub } from '@/components/common/PhaseStub'

export default function PortionsPage() {
  return (
    <PhaseStub
      title="Порції на день"
      description="Скільки чого готувати найближчого дня."
      phase={5}
      plan={[
        'Порції по стравах із v_orders_by_dish, окремо пільгові та додані після дедлайну',
        'Колонка вартості й підсумок за день',
        'Розбивка по класах',
        'Друк і експорт у CSV',
      ]}
    />
  )
}
