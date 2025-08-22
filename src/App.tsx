import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { WalletConnector } from "@/components/wallet-connector"
import { WalletInfo } from "@/components/wallet-info"
import { CustomKeySigner } from "@/components/custom-key-signer"
import { WalletMessageSigner } from "@/components/wallet-message-signer"
import { ThemeToggle } from "@/components/theme-toggle"
import { CollapsibleSection } from "@/components/collapsible-section"
import { 
  Wallet, 
  Lock
} from "lucide-react"
import { useState } from "react"
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
          <CollapsibleSection
            title="Wallet Message Signer"
            description="Sign messages using your connected wallet"
            icon={Wallet}
            iconColor="bg-blue-500"
            isExpanded={showWalletSigner}
            onToggle={() => setShowWalletSigner(!showWalletSigner)}
          >
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
          </CollapsibleSection>

          {/* Custom Key Signer */}
          <CollapsibleSection
            title="Custom Key Signer"
            description="Sign messages using a custom private key (always available)"
            icon={Lock}
            iconColor="bg-neutral-500"
            isExpanded={showCustomSigner}
            onToggle={() => setShowCustomSigner(!showCustomSigner)}
          >
            <CustomKeySigner />
          </CollapsibleSection>
        </div>
      </main>
    </div>
  )
}

export default App
