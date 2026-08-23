import { PhaseStub } from '@/components/common/PhaseStub'

export default function ClassRosterPage() {
  return (
    <PhaseStub
      title="Мій клас"
      description="Ті, хто харчується. Це не список класу цілком."
      phase={3}
      plan={[
        'Пошук по прізвищу, позначка пільги, наявність логіна, статус замовлення на день',
        '«Харчуються N із M», де M — розмір класу від адміністрації',
        'Додавання учня з датою enrolled_from',
        'Пільговий статус із приміткою та останнім записом журналу',
        'Видача логінів і скидання паролів — Фаза 4',
      ]}
    />
  )
}
