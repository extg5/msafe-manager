import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { WalletConnector } from "@/components/wallet-connector"
import { WalletInfo } from "@/components/wallet-info"
import { CustomKeyTester } from "@/components/custom-key-tester"
import { ThemeToggle } from "@/components/theme-toggle"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

function App() {
  const { account, connected } = useWallet()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Aptos Signer</h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <WalletConnector />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="text-center space-y-4">
            <h2 className="text-3xl font-bold tracking-tighter">
              Welcome to Aptos Signer
            </h2>
            <p className="text-xl text-muted-foreground">
              Connect your wallet to get started with Aptos blockchain transactions
            </p>
          </div>

          <div className="space-y-6">
            {connected && account ? (
              <WalletInfo />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Connect Your Wallet</CardTitle>
                  <CardDescription>
                    Please connect your Aptos wallet to continue
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-center">
                    <WalletConnector />
                  </div>
                </CardContent>
              </Card>
            )}
            
            <CustomKeyTester 
              isCollapsible={true} 
              defaultCollapsed={!connected || !account} 
            />
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
