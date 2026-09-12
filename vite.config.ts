import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const serverPort = Number(process.env.PROVIA_SERVER_PORT ?? 43124)

export default defineConfig({
  plugins: [vue()],
  server: {
    // Uncommon port: Cursor Cloud Preview does not reliably tunnel Vite's default 5173.
    port: 43123,
    strictPort: true,
    host: true,
    allowedHosts: true,
    cors: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${serverPort}`,
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: 43123,
    strictPort: true,
    host: true,
    allowedHosts: true,
    cors: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${serverPort}`,
        changeOrigin: true,
      },
    },
  },
})
