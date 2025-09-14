import { ThemeToggle } from "@/components/theme-toggle"
import { WalletConnector } from "@/components/wallet-connector"
import { useEffectiveTheme } from "@/hooks/use-theme"
import { Link } from "react-router-dom"
import aptosLogoDark from "@/assets/aptos-logomark-dark.svg"
import aptosLogoLight from "@/assets/aptos-logomark-light.svg"

export function Header() {
  const effectiveTheme = useEffectiveTheme()

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <div className="">
              <img 
                src={effectiveTheme === 'dark' ? aptosLogoDark : aptosLogoLight} 
                alt="Aptos Logo" 
                className="h-8 w-8"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">MSafe Manager</h1>
              <p className="text-sm text-muted-foreground">Secure MSafe multisig management</p>
            </div>
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <WalletConnector />
        </div>
      </div>
    </header>
  )
}
