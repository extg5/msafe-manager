import { useContext, useMemo } from "react"
import { ThemeProviderContext } from "@/contexts/theme-context"

export function useTheme() {
  const context = useContext(ThemeProviderContext)

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider")

  return context
}

export function useEffectiveTheme() {
  const { theme } = useTheme()
  
  const effectiveTheme = useMemo(() => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return theme
  }, [theme])
  
  return effectiveTheme
}
