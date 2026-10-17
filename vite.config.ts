import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "https://sayso.tahcin.tech", ws: true, changeOrigin: true } } },
})
