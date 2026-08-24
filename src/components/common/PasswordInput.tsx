import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Поле пароля з кнопкою показу.
 *
 * Пароль тут ніде не осідає: він живе в стані форми рівно стільки, скільки
 * відкритий екран. Кнопка лише перемикає type поля.
 */
export function PasswordInput({
  id,
  value,
  onChange,
  autoComplete = 'current-password',
  required,
  className,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  autoComplete?: string
  required?: boolean
  className?: string
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? 'text' : 'password'}
        autoComplete={autoComplete}
        required={required}
        className={cn('pr-10', className)}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="absolute right-1 top-1/2 -translate-y-1/2"
        aria-label={visible ? 'Сховати пароль' : 'Показати пароль'}
        aria-pressed={visible}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
      </Button>
    </div>
  )
}
