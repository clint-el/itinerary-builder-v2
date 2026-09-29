/// <reference types="vitest/config" />
import path from 'path'
import dotenv from 'dotenv'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { createVoucherMailMiddleware } from './server/voucherMailMiddleware.js'

dotenv.config()

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'voucher-mail-api',
      configureServer(server) {
        server.middlewares.use(createVoucherMailMiddleware())
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
