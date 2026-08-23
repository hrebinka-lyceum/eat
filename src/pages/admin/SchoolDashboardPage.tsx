import { PhaseStub } from '@/components/common/PhaseStub'

export default function SchoolDashboardPage() {
  return (
    <PhaseStub
      title="Дашборд школи"
      description="Замовлення, охоплення й вартість по всій школі."
      phase={5}
      plan={[
        'v_daily_totals, v_class_coverage, v_orders_by_dish',
        'Вартість за день і за місяць, окремо пільгові та звичайні',
        'Підказка, якщо в класів не заповнено розмір',
        'Експорт кожної таблиці',
      ]}
    />
  )
}
