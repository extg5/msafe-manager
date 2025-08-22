import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { WalletConnector } from "@/components/wallet-connector"
import { WalletInfo } from "@/components/wallet-info"
import { CustomKeySigner } from "@/components/custom-key-signer"
import { WalletMessageSigner } from "@/components/wallet-message-signer"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Wallet, 
  Lock,
  ChevronDown
} from "lucide-react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useEffectiveTheme } from "@/hooks/use-theme"
import aptosLogoDark from "@/assets/aptos-logomark-dark.svg"
import aptosLogoLight from "@/assets/aptos-logomark-light.svg"

function App() {
  const { account, connected } = useWallet()
  const effectiveTheme = useEffectiveTheme()
  const [showWalletSigner, setShowWalletSigner] = useState(true) // always open by default
  const [showCustomSigner, setShowCustomSigner] = useState(false) // collapsed by default

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header */}
      <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="">
              <img 
                src={effectiveTheme === 'dark' ? aptosLogoDark : aptosLogoLight} 
                alt="Aptos Logo" 
                className="h-8 w-8"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Aptos Signer</h1>
              <p className="text-sm text-muted-foreground">Secure message signing tool</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletConnector />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 space-y-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Wallet Info Section */}
          {connected && account?.address && (
            <WalletInfo />
          )}

          {/* Wallet Message Signer */}
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowWalletSigner(!showWalletSigner)}
          >
            <CardHeader className="">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-blue-500 rounded-lg shrink-0">
                    <Wallet className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg">
                      Wallet Message Signer
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Sign messages using your connected wallet
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0 m-auto bg-accent dark:bg-accent/40"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowWalletSigner(!showWalletSigner)
                  }}
                >
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform duration-200 ${
                      showWalletSigner ? "scale-100" : "-scale-100"
                    }`}
                  />
                </Button>
              </div>
            </CardHeader>
            {showWalletSigner && (
              <CardContent onClick={(e) => e.stopPropagation()}>
                {connected && account?.address ? (
                  <WalletMessageSigner />
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm text-muted-foreground mb-3">
                      Connect your Aptos wallet to use wallet-based signing
                    </p>
                    <WalletConnector />
                  </div>
                )}
              </CardContent>
            )}
          </Card>

          {/* Custom Key Signer */}
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => setShowCustomSigner(!showCustomSigner)}
          >
            <CardHeader className="">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 bg-neutral-500 rounded-lg shrink-0">
                    <Lock className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="text-lg">
                      Custom Key Signer
                    </CardTitle>
                    <CardDescription className="mt-1">
                      Sign messages using a custom private key (always available)
                    </CardDescription>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0 m-auto bg-accent dark:bg-accent/40"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowCustomSigner(!showCustomSigner)
                  }}
                >
                  <ChevronDown 
                    className={`h-4 w-4 transition-transform duration-200 ${
                      showCustomSigner ? "scale-100" : "-scale-100"
                    }`}
                  />
                </Button>
              </div>
            </CardHeader>
            {showCustomSigner && (
              <CardContent onClick={(e) => e.stopPropagation()}>
                <CustomKeySigner />
              </CardContent>
            )}
          </Card>
        </div>
      </main>
    </div>
  )
}

export default App
