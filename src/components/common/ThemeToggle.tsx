import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * Перемикач світлої й темної теми.
 *
 * До монтування ще невідомо, що збережено в браузері, тому іконку
 * показуємо лише після — інакше на мить блимала б не та.
 */
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === 'dark'

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={isDark ? 'Світла тема' : 'Темна тема'}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
    >
      {mounted ? (
        isDark ? (
          <Sun className="size-5" aria-hidden />
        ) : (
          <Moon className="size-5" aria-hidden />
        )
      ) : (
        <span className="size-5" aria-hidden />
      )}
    </Button>
  )
}
