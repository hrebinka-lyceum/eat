import { PhaseStub } from '@/components/common/PhaseStub'

export default function TeacherMenuPage() {
  return (
    <PhaseStub
      title="Меню"
      description="Перегляд меню на найближчі дні."
      phase={2}
      plan={[
        'Список днів і склад меню, лише читання',
        'Без цін',
      ]}
    />
  )
}
