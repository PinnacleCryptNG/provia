import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vite'

const serverPort = Number(process.env.PROVIA_SERVER_PORT ?? 43124)

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${serverPort}`,
        changeOrigin: true,
      },
    },
  },
})
