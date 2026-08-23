import { PhaseStub } from '@/components/common/PhaseStub'

export default function PromoteYearPage() {
  return (
    <PhaseStub
      title="Переведення року"
      description="Незворотна дія з підтвердженням."
      phase={6}
      plan={[
        'Підтвердження введенням назви нового року вручну',
        'Звіт про виконання',
        'Одразу за ним — призначення керівників новим п\'ятим класам із v_unassigned_teachers',
      ]}
    />
  )
}
