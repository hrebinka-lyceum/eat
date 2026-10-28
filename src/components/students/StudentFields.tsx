import { useQuery } from '@tanstack/react-query'
import { listPrivilegeCategories } from '@/api/privilegeCategories'
import type { PrivilegeChoice } from '@/api/students'
import { qk } from '@/lib/queryKeys'
import { GENDER_LABELS } from '@/lib/format'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Gender } from '@/types/database'

const NONE = 'none'
const UNCATEGORIZED = 'uncategorized'

export function GenderSelect({
  id,
  value,
  onChange,
}: {
  id: string
  value: Gender | null
  onChange: (value: Gender) => void
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Стать</Label>
      <Select value={value ?? ''} onValueChange={(next) => onChange(next as Gender)}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Не вказано" />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(GENDER_LABELS) as Gender[]).map((gender) => (
            <SelectItem key={gender} value={gender}>
              {GENDER_LABELS[gender]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

function choiceToValue(choice: PrivilegeChoice): string {
  if (choice.kind === 'category') return choice.categoryId
  return choice.kind === 'none' ? NONE : UNCATEGORIZED
}

function valueToChoice(value: string): PrivilegeChoice {
  if (value === NONE) return { kind: 'none' }
  if (value === UNCATEGORIZED) return { kind: 'uncategorized' }
  return { kind: 'category', categoryId: value }
}

/**
 * Пільгова категорія зі списку, який веде адміністрація.
 *
 * Вимкнені категорії не пропонуються, але та, що вже стоїть в учня,
 * лишається видимою — інакше поле показувало б порожнечу. «Пільга без
 * категорії» з'являється лише в тих, кому пільгу ставили до появи категорій.
 */
export function PrivilegeSelect({
  id,
  value,
  initial,
  onChange,
}: {
  id: string
  value: PrivilegeChoice
  /** що стояло в учня до редагування */
  initial: PrivilegeChoice
  onChange: (value: PrivilegeChoice) => void
}) {
  const categoriesQuery = useQuery({
    queryKey: qk.privilegeCategories(),
    queryFn: listPrivilegeCategories,
  })
  const categories = categoriesQuery.data ?? []
  const initialId = initial.kind === 'category' ? initial.categoryId : null
  const offered = categories.filter((category) => category.is_active || category.id === initialId)

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Пільгова категорія</Label>
      <Select value={choiceToValue(value)} onValueChange={(next) => onChange(valueToChoice(next))}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>Без пільги</SelectItem>
          {offered.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
              {category.is_active ? '' : ' (вимкнена)'}
            </SelectItem>
          ))}
          {initial.kind === 'uncategorized' ? (
            <SelectItem value={UNCATEGORIZED}>Пільга без категорії</SelectItem>
          ) : null}
        </SelectContent>
      </Select>
      {categoriesQuery.data && offered.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Категорій ще немає — їх додає адміністрація в «Налаштуваннях школи».
        </p>
      ) : null}
    </div>
  )
}
