import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronDown, X } from 'lucide-react'
import { listPrivilegeCategories } from '@/api/privilegeCategories'
import type { PrivilegeSelection } from '@/api/students'
import { qk } from '@/lib/queryKeys'
import { GENDER_LABELS } from '@/lib/format'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { Gender } from '@/types/database'

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

/**
 * Пільгові категорії учня — кілька зі списку, який веде адміністрація.
 *
 * Випадний список з галочками не закривається після вибору, щоб можна було
 * відмітити кілька поспіль; обрані показуються під ним «чипами» з хрестиком
 * у порядку вибору. Порядок важливий: у звітах дитина рахується за першою.
 * Вимкнені категорії не пропонуються, але ті, що вже стоять в учня, лишаються
 * видимими — інакше вони зникли б з картки мовчки. «Пільга без категорії» —
 * лише в тих, кому пільгу ставили до появи категорій; додали категорію — вона
 * зникає сама.
 */
export function PrivilegeMultiSelect({
  id,
  value,
  initialIds,
  onChange,
}: {
  id: string
  value: PrivilegeSelection
  /** категорії, що стояли в учня до редагування */
  initialIds: string[]
  onChange: (value: PrivilegeSelection) => void
}) {
  const categoriesQuery = useQuery({
    queryKey: qk.privilegeCategories(),
    queryFn: listPrivilegeCategories,
  })
  const categories = useMemo(() => categoriesQuery.data ?? [], [categoriesQuery.data])
  const nameOf = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const offered = categories.filter(
    (category) => category.is_active || initialIds.includes(category.id) || value.categoryIds.includes(category.id),
  )
  const selected = new Set(value.categoryIds)

  const toggle = (categoryId: string, checked: boolean) =>
    onChange({
      categoryIds: checked
        ? [...value.categoryIds, categoryId]
        : value.categoryIds.filter((other) => other !== categoryId),
      uncategorized: false,
    })

  const summary =
    value.categoryIds.length > 0
      ? `Обрано: ${value.categoryIds.length}`
      : value.uncategorized
        ? 'Пільга без категорії'
        : 'Без пільги'

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Пільгові категорії</Label>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button id={id} variant="outline" className="w-full justify-between font-normal">
            {summary}
            <ChevronDown className="size-4 opacity-50" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width) min-w-56">
          {offered.map((category) => (
            <DropdownMenuCheckboxItem
              key={category.id}
              checked={selected.has(category.id)}
              onCheckedChange={(checked) => toggle(category.id, checked === true)}
              // Не закривати після вибору: категорій часто кілька.
              onSelect={(event) => event.preventDefault()}
            >
              {category.name}
              {category.is_active ? '' : ' (вимкнена)'}
            </DropdownMenuCheckboxItem>
          ))}
          {categoriesQuery.data && offered.length === 0 ? (
            <p className="px-2 py-1.5 text-sm text-muted-foreground">
              Категорій ще немає — їх додає адміністрація в «Налаштуваннях школи».
            </p>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      {value.categoryIds.length > 0 || value.uncategorized ? (
        <ul className="flex flex-wrap gap-1.5" aria-label="Обрані пільгові категорії">
          {value.categoryIds.map((categoryId) => {
            const name = nameOf.get(categoryId)?.name ?? 'Невідома категорія'
            return (
              <li key={categoryId}>
                <Badge variant="secondary" className="gap-1 pr-1">
                  {name}
                  <button
                    type="button"
                    className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                    aria-label={`Прибрати «${name}»`}
                    onClick={() => toggle(categoryId, false)}
                  >
                    <X className="size-3" aria-hidden />
                  </button>
                </Badge>
              </li>
            )
          })}
          {value.categoryIds.length === 0 && value.uncategorized ? (
            <li>
              <Badge variant="secondary" className="gap-1 pr-1">
                Пільга без категорії
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted-foreground/20"
                  aria-label="Зняти пільгу"
                  onClick={() => onChange({ categoryIds: [], uncategorized: false })}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ) : null}
        </ul>
      ) : null}

      {value.categoryIds.length > 1 ? (
        <p className="text-xs text-muted-foreground">
          У звітах дитину враховано за першою категорією — «
          {nameOf.get(value.categoryIds[0])?.name ?? 'невідома'}». Щоб змінити, приберіть її і
          додайте знову — вона стане останньою.
        </p>
      ) : null}
    </div>
  )
}
