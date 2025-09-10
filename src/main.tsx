import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './components/theme-provider.tsx'
import { WalletProvider } from './components/wallet-provider.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider defaultTheme="system" storageKey="msafe-manager-theme">
      <WalletProvider>
        <App />
      </WalletProvider>
    </ThemeProvider>
  </StrictMode>,
)
