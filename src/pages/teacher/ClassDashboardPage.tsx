import { PhaseStub } from '@/components/common/PhaseStub'

export default function ClassDashboardPage() {
  return (
    <PhaseStub
      title="Дашборд класу"
      description="Охоплення й пропуски по своєму класу."
      phase={5}
      plan={[
        'Обидва відсотки охоплення з розгорнутими підписами',
        'Експорт у CSV',
        'Без вартості',
      ]}
    />
  )
}
