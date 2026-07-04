import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@', replacement: fileURLToPath(new URL('./src', import.meta.url)) },
      // Consume @workflo/ui from source for HMR. Regex with $ matches only the bare
      // specifier so subpaths (e.g. @workflo/ui/styles.css) resolve via package exports.
      { find: /^@workflo\/ui$/, replacement: fileURLToPath(new URL('../../packages/ui/src/index.ts', import.meta.url)) },
    ],
  },
  server: {
    port: 3001,
    proxy: {
      '/api': {
        // 127.0.0.1 явно: `localhost` у Node ≥17 резолвиться в ::1, а API слухає IPv4.
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    rollupOptions: {
      // 'use client' directives in @workflo/ui are for Next; bundlers ignore them.
      onwarn(warning, warn) {
        if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
        warn(warning)
      },
    },
  },
})
