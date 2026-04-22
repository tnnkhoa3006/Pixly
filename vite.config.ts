import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Tauri: ensure fixed port so devUrl always resolves
  server: {
    port: 5173,
    strictPort: true,
  },

  // Tauri: don't obscure Rust compiler errors
  clearScreen: false,
})
