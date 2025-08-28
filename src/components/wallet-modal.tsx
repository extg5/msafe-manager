import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Wallet, ExternalLink } from "lucide-react"

interface WalletModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
    const { connect, wallets } = useWallet()

  const handleConnect = async (walletName: string) => {
    try {
      await connect(walletName)
      onOpenChange(false)
    } catch (error) {
      console.error("Failed to connect wallet:", error)
    }
  }

  const popularWallets = [
    { name: "Petra", url: "https://petra.app/" },
    { name: "Pontem", url: "https://pontem.network/pontem-wallet" },
    { name: "Martian", url: "https://martianwallet.xyz/" },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect Wallet
          </DialogTitle>
          <DialogDescription>
            Choose a wallet to connect to the Aptos blockchain
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          {wallets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Wallet className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-sm font-medium mb-2">No Aptos wallets detected</p>
              <p className="text-xs mb-6">Install one of these popular wallets to continue:</p>
              
              <div className="grid gap-2">
                {popularWallets.map((wallet) => (
                  <Button
                    key={wallet.name}
                    variant="outline"
                    size="sm"
                    asChild
                    className="justify-between"
                  >
                    <a 
                      href={wallet.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <span>Install {wallet.name}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <div className="text-sm text-muted-foreground mb-2">
                Available wallets ({wallets.length})
              </div>
              {wallets.map((wallet) => (
                <Button
                  key={wallet.name}
                  variant="outline"
                  className="h-16 p-4 justify-start gap-4 hover:bg-muted hover:border-primary/50 transition-all duration-200 group"
                  onClick={() => handleConnect(wallet.name)}
                >
                  {wallet.icon && (
                    <div className="h-8 w-8 flex-shrink-0 bg-background rounded-md p-1">
                      <img 
                        src={wallet.icon} 
                        alt={wallet.name} 
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex flex-col items-start">
                    <span className="font-medium group-hover:text-primary transition-colors">
                      {wallet.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Connect using {wallet.name}
                    </span>
                  </div>
                </Button>
              ))}
            </>
          )}
        </div>
        
        {wallets.length > 0 && (
          <div className="text-center border-t pt-4">
            <p className="text-xs text-muted-foreground">
              Don't see your wallet?{" "}
              <Button variant="link" className="p-0 h-auto text-xs" asChild>
                <a 
                  href="https://aptosfoundation.org/ecosystem/projects/wallets" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  View all supported wallets
                </a>
              </Button>
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
