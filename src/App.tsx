import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { WalletConnector } from "@/components/wallet-connector"
import { WalletInfo } from "@/components/wallet-info"
import { CustomKeySigner } from "@/components/custom-key-signer"
import { WalletMessageSigner } from "@/components/wallet-message-signer"
import { ThemeToggle } from "@/components/theme-toggle"
import { CollapsibleSection } from "@/components/collapsible-section"
import { 
  Wallet, 
  Lock,
  GitCompare,
} from "lucide-react"
import { useState, useEffect, useCallback } from "react"
import { useEffectiveTheme } from "@/hooks/use-theme"
import aptosLogoDark from "@/assets/aptos-logomark-dark.svg"
import aptosLogoLight from "@/assets/aptos-logomark-light.svg"
import { SignatureComparison } from "@/components/signature-comparison"
import { Badge } from "@/components/ui/badge"

function App() {
  const { account, connected } = useWallet()
  const effectiveTheme = useEffectiveTheme()
  const [showWalletSigner, setShowWalletSigner] = useState(true) // always open by default
  const [showCustomSigner, setShowCustomSigner] = useState(false) // collapsed by default
  const [showSignatureComparison, setShowSignatureComparison] = useState(false) // collapsed by default
  
  const [selectedSignature, setSelectedSignature] = useState<"wallet" | "custom" | null>(null)
  // Signature states for comparison
  const [walletSignature, setWalletSignature] = useState("")
  const [customSignature, setCustomSignature] = useState("")
  const [comparisonResult, setComparisonResult] = useState<{
    isMatch: boolean
    selectedSig: string
    selectedType: string
  } | null>(null)

  // Memoize callback to prevent unnecessary re-renders
  const handleComparisonChange = useCallback((result: {
    isMatch: boolean
    selectedSig: string
    selectedType: string
  } | null) => {
    setComparisonResult(result)
  }, [])

  // Wrapper functions that auto-select signature when setting it
  const handleWalletSignatureChange = useCallback((signature: string) => {
    setWalletSignature(signature)
    if (signature.trim()) {
      setSelectedSignature("wallet")
    } else if (!customSignature.trim()) {
      setSelectedSignature(null)
    }
  }, [customSignature])

  const handleCustomSignatureChange = useCallback((signature: string) => {
    setCustomSignature(signature)
    if (signature.trim()) {
      setSelectedSignature("custom")
    } else if (!walletSignature.trim()) {
      setSelectedSignature(null)
    }
  }, [walletSignature])

  // Auto-expand signature comparison when signatures are available
  useEffect(() => {
    if (walletSignature || customSignature) {
      setShowSignatureComparison(true)
    }
  }, [walletSignature, customSignature])

  // Always show signature comparison component
  const showSignatureComparisonBlock = true

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
              <WalletMessageSigner onSignatureChange={handleWalletSignatureChange} />
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
            <CustomKeySigner onSignatureChange={handleCustomSignatureChange} />
          </CollapsibleSection>

          {/* Signature Comparison */}
          {showSignatureComparisonBlock && (
            <CollapsibleSection
              title={
                <div className="flex items-center gap-2">
                  <span>Signature Comparison</span>
                  {comparisonResult && (
                    <div className="flex items-center gap-1">
                      {comparisonResult && (
                        <Badge 
                          variant={comparisonResult.isMatch ? "default" : "destructive"}
                          className={comparisonResult.isMatch ? "bg-green-500" : "bg-red-500"}
                        >
                          {comparisonResult.isMatch ? `✓ ${comparisonResult.selectedType}` : `✗ ${comparisonResult.selectedType}`}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              }
              description={
                comparisonResult 
                  ? `Comparing ${comparisonResult.selectedType.toLowerCase()} with target signature`
                  : "Compare signatures with target signature"
              }
              icon={GitCompare}
              iconColor="bg-neutral-500"
              isExpanded={showSignatureComparison}
              onToggle={() => setShowSignatureComparison(!showSignatureComparison)}
            >
              <SignatureComparison 
                selectedSignature={selectedSignature}
                walletSignature={walletSignature}
                customSignature={customSignature}
                onComparisonChange={handleComparisonChange}
                onChangeSelectedSignature={setSelectedSignature}
              />
            </CollapsibleSection>
          )}
        </div>
      </main>
    </div>
  )
}

export default App
