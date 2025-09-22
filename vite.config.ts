import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { nodePolyfills } from 'vite-plugin-node-polyfills'
 
// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Get base path from environment variable, fallback to default
  const basePath = process.env.VITE_BASE_PATH || (mode === 'production' ? '/msafe-manager/' : '/')
  
  return {
    plugins: [react(), tailwindcss(), nodePolyfills({globals: {
      Buffer: true, // can also be 'build', 'dev', or false
      global: true,
      process: true,
    },})],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    base: basePath,
  }
})
