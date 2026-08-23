import { PhaseStub } from '@/components/common/PhaseStub'

export default function StudentSearchPage() {
  return (
    <PhaseStub
      title="Пошук учня"
      description="Ключовий інструмент адміністратора."
      phase={6}
      plan={[
        'Пошук по всій школі',
        'Картка учня: клас, пільга, логін, замовлення',
        'Замовлення за будь-кого будь-коли, зокрема після дедлайну',
        'Скасування замовлення',
        'Переведення в інший клас',
      ]}
    />
  )
}
