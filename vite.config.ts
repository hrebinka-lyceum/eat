import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Застосунок живе за адресою https://hrebinka-lyceum.github.io/eat/
// base і basename роутера мають збігатися, інакше — білий екран без помилок.
export default defineConfig(({ mode }) => ({
  base: '/eat/',
  // Tailwind у тестах не потрібен (css: false), а вантажиться помітно.
  // Vitest читає цей самий конфіг у режимі 'test'.
  plugins: [react(), ...(mode === 'test' ? [] : [tailwindcss()])],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  // Тести живуть у тому самому конфізі навмисно: окремий vitest.config
  // дублював би аліас @, і після його зміни тести мовчки резолвили б
  // старі шляхи.
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    // Клієнт Supabase падає при старті без цих змінних; у тестах він
    // однаково замоканий, тож підставляємо заглушки.
    env: {
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      // Тести завжди в UTC — як у GitHub Actions. Інакше київський пояс
      // розробника ховає помилки з датами: monthBounds повертав перше
      // число наступного місяця скрізь, де пояс відстає від київського.
      TZ: 'UTC',
    },
    css: false,
    restoreMocks: true,
  },
}))
