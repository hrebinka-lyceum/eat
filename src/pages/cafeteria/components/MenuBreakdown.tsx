import { useQuery } from '@tanstack/react-query'
import { listMenuItems } from '@/api/menu'
import { listSpecialMenus } from '@/api/specialMenus'
import { ordersByMenu } from '@/api/stats'
import { qk } from '@/lib/queryKeys'
import { specialMenuLabel } from '@/lib/format'
import { ErrorState } from '@/components/common/states'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface MenuRow {
  key: string
  label: string
  classes: string
  components: string
  portions: number
}

/**
 * Розбивка порцій за меню — лише в дні зі спеціальними меню. Основне блюдо й
 * кожне спеціальне готуються окремо, тож кухарю потрібне число саме по меню;
 * таблиця компонентів нижче лишається спільною (для закупівлі).
 *
 * Порції — зі зліпка orders.special_menu_id: що замовлено, те й готувати.
 */
export function MenuBreakdown({ date }: { date: string }) {
  const specialQuery = useQuery({
    queryKey: qk.specialMenus(date),
    queryFn: () => listSpecialMenus(date),
  })
  const hasSpecial = (specialQuery.data ?? []).length > 0

  const itemsQuery = useQuery({
    queryKey: qk.menuItems(date),
    queryFn: () => listMenuItems(date),
    enabled: hasSpecial,
  })
  const countsQuery = useQuery({
    queryKey: qk.ordersByMenu(date),
    queryFn: () => ordersByMenu(date),
    enabled: hasSpecial,
  })

  const error = specialQuery.error ?? itemsQuery.error ?? countsQuery.error
  if (error) return <ErrorState error={error} />
  if (!hasSpecial || !itemsQuery.data || !countsQuery.data) return null

  const namesOf = (specialMenuId: string | null) =>
    itemsQuery.data
      .filter((item) => item.special_menu_id === specialMenuId)
      .map((item) => item.dishes.name)
      .sort((a, b) => a.localeCompare(b, 'uk'))
      .join(' · ') || 'ще не складено'

  const rows: MenuRow[] = [
    {
      key: 'main',
      label: 'Основне меню',
      classes: 'решта класів',
      components: namesOf(null),
      portions: countsQuery.data.main,
    },
    ...(specialQuery.data ?? []).map((menu) => ({
      key: menu.id,
      label: specialMenuLabel(menu.name),
      classes: menu.classes.map((klass) => klass.name).join(', '),
      components: namesOf(menu.id),
      portions: countsQuery.data.special[menu.id] ?? 0,
    })),
  ]

  return (
    <div className="space-y-3">
      <h2 className="font-medium">Меню дня</h2>
      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Меню</TableHead>
              <TableHead>Класи</TableHead>
              <TableHead>Склад</TableHead>
              <TableHead className="text-right">Порцій</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-muted-foreground">{row.classes}</TableCell>
                <TableCell className="whitespace-normal">{row.components}</TableCell>
                <TableCell className="text-right text-base font-semibold tabular-nums">
                  {row.portions}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
