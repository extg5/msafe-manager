import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Header } from "@/components/header"
import { Card } from "@/components/ui/card"
import { MSafeAccountList } from "@/components/msafe-account-list"
import { WalletConnector } from "@/components/wallet-connector"
import { Shield, Wallet, MousePointer, Send } from "lucide-react"

export function HomePage() {
  const { connected, account } = useWallet()

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-12">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Withdraw from MSafe Multisig
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Create withdrawal requests and manage funds from your MSafe multisig wallets on Aptos
            </p>
          </div>

          {/* Flow Section */}
          <div className="text-center space-y-6">
            <div className="flex items-center justify-center gap-4 md:gap-8">
              {/* Step 1 */}
              <div className="flex flex-col items-center space-y-2">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
                  <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <span className="text-sm font-medium">Connect Wallet</span>
                <span className="text-xs text-muted-foreground">Connect your Aptos wallet</span>
              </div>
              
              <div className="w-8 h-px bg-muted-foreground/30 hidden md:block" />
              
              {/* Step 2 */}
              <div className="flex flex-col items-center space-y-2">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-full">
                  <MousePointer className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <span className="text-sm font-medium">Select Multisig</span>
                <span className="text-xs text-muted-foreground">Choose MSafe account below</span>
              </div>
              
              <div className="w-8 h-px bg-muted-foreground/30 hidden md:block" />
              
              {/* Step 3 */}
              <div className="flex flex-col items-center space-y-2">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-full">
                  <Send className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <span className="text-sm font-medium">Create Request</span>
                <span className="text-xs text-muted-foreground">Request funds withdrawal</span>
              </div>
            </div>
          </div>

          {/* MSafe Accounts Section */}
          <div className="space-y-4 mt-20">
            {connected && account?.address ? (
              <MSafeAccountList />
            ) : (
              <Card className="p-6">
                <div className="text-center space-y-4">
                  <Shield className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Connect to View Wallets</h3>
                    <p className="text-muted-foreground mb-4">
                      Connect your Aptos wallet to see available MSafe wallets for withdrawal
                    </p>
                    <WalletConnector />
                  </div>
                </div>
              </Card>
            )}
          </div>


        </div>
      </main>
    </div>
  )
}
