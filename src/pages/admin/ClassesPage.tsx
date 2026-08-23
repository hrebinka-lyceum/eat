import { PhaseStub } from '@/components/common/PhaseStub'

export default function ClassesPage() {
  return (
    <PhaseStub
      title="Класи"
      description="Склад класів і їхні розміри."
      phase={6}
      plan={[
        'Редагування classes.total_students',
        'Без цього числа coverage_class_pct лишається порожнім',
        'Призначення класних керівників',
      ]}
    />
  )
}
