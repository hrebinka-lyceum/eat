import { useState } from 'react'
import { Check, Copy, Download, TriangleAlert } from 'lucide-react'
import { toast } from 'sonner'
import { exportToCsv, csvFilename } from '@/lib/csv'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface Credential {
  full_name: string
  login: string
  password: string
}

/**
 * Показ виданих паролів.
 *
 * ⚠ Сервер віддає пароль рівно один раз і ніде його не зберігає. Це вікно —
 * єдина можливість його забрати, тому воно не закривається ні по Esc, ні
 * кліком повз: тільки явною кнопкою, поруч з якою написано, чим це загрожує.
 *
 * Пароль живе тільки в пропсах цього компонента, поки вікно відкрите.
 * Ні в кеш запитів, ні в localStorage він не потрапляє.
 */
export function CredentialsDialog({
  credentials,
  title,
  skipped,
  onClose,
}: {
  credentials: Credential[] | null
  title: string
  skipped?: Array<{ name: string; reason: string }>
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  if (!credentials || credentials.length === 0) return null

  // Скидання пароля не змінює логін, і функція його не повертає. У такому
  // разі колонка логіна тільки заважала б.
  const showLogin = credentials.some((item) => item.login !== '—')

  const asText = credentials
    .map((item) =>
      showLogin
        ? `${item.full_name}\t${item.login}\t${item.password}`
        : `${item.full_name}\t${item.password}`,
    )
    .join('\n')

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText)
      setCopied(true)
      toast.success('Скопійовано')
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Браузер не дав доступ до буфера обміну. Завантажте CSV або перепишіть вручну.')
    }
  }

  const download = () => {
    exportToCsv(
      credentials,
      showLogin
        ? [
            { header: 'ПІБ', value: (item: Credential) => item.full_name },
            { header: 'Логін', value: (item: Credential) => item.login },
            { header: 'Пароль', value: (item: Credential) => item.password },
          ]
        : [
            { header: 'ПІБ', value: (item: Credential) => item.full_name },
            { header: 'Пароль', value: (item: Credential) => item.password },
          ],
      csvFilename('логіни'),
    )
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        showCloseButton={false}
        className="max-w-2xl"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Передайте ці дані власникам акаунтів. При першому вході система попросить
            змінити пароль.{showLogin ? '' : ' Логін лишається попереднім.'}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <TriangleAlert className="size-4" aria-hidden />
          <AlertTitle>Паролі показуються один раз</AlertTitle>
          <AlertDescription>
            Після закриття цього вікна пароль не відновити — його можна буде лише
            скинути наново. Скопіюйте або завантажте CSV зараз.
          </AlertDescription>
        </Alert>

        <div className="max-h-72 overflow-y-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ПІБ</TableHead>
                {showLogin ? <TableHead>Логін</TableHead> : null}
                <TableHead>Пароль</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {credentials.map((item) => (
                <TableRow key={`${item.full_name}-${item.password}`}>
                  <TableCell>{item.full_name}</TableCell>
                  {showLogin ? (
                    <TableCell className="font-mono text-xs">{item.login}</TableCell>
                  ) : null}
                  <TableCell className="font-mono text-xs">{item.password}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {skipped && skipped.length > 0 ? (
          <div className="rounded-lg border border-dashed p-3 text-sm">
            <p className="font-medium">Пропущено</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {skipped.map((item) => (
                <li key={item.name}>
                  {item.name} — {item.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <DialogFooter className="sm:justify-between">
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void copy()}>
              {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
              Скопіювати
            </Button>
            <Button variant="outline" onClick={download}>
              <Download className="size-4" aria-hidden />
              Завантажити CSV
            </Button>
          </div>
          <Button onClick={onClose}>Я зберіг, закрити</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
