import { PhaseStub } from '@/components/common/PhaseStub'

export default function ReportsPage() {
  return (
    <PhaseStub
      title="Звіти"
      description="Місце для звітів бухгалтерії та управління освіти."
      phase={7}
      plan={[
        'Розділ зарезервовано навмисно',
        'Основа вже є: v_student_month, class_enrollments і зліпки в orders',
        'Експорт у CSV спільною утилітою exportToCsv',
      ]}
    />
  )
}
