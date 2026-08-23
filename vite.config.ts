import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Застосунок живе за адресою https://hrebinka-lyceum.github.io/eat/
// base і basename роутера мають збігатися, інакше — білий екран без помилок.
export default defineConfig({
  base: '/eat/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
