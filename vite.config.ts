import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  build: {
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('/node_modules/ant-design-vue') || id.includes('/node_modules/@ant-design')) return 'ui-antdv'
          if (id.includes('/node_modules/vue/') || id.includes('/node_modules/pinia/') || id.includes('/node_modules/vue-router/')) {
            return 'framework'
          }
          if (id.includes('markdown-it') || id.includes('katex') || id.includes('dompurify')) return 'markdown'
          return 'vendor'
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
