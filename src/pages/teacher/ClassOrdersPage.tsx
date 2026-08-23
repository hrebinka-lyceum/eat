import { PhaseStub } from '@/components/common/PhaseStub'

export default function ClassOrdersPage() {
  return (
    <PhaseStub
      title="Замовлення класу"
      description="Таблиця «учень × страви» на обраний день."
      phase={3}
      plan={[
        'Відмітка кількох учнів одразу',
        'Пільговим комплекс підставляється сам',
        'Жодних сум на екрані',
      ]}
    />
  )
}
