import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
 
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Get base path from environment variable, fallback to default
  const basePath = process.env.VITE_BASE_PATH || (mode === 'production' ? '/msafe-manager/' : '/')
  
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: basePath,
  }
})
