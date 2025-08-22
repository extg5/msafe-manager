import { useState } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Button } from "@/components/ui/button"
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu"
import { WalletModal } from "./wallet-modal"
import { Copy, ExternalLink, LogOut, Wallet } from "lucide-react"

export function WalletConnector() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const { 
    disconnect, 
    account, 
    connected, 
    wallet: connectedWallet
  } = useWallet()

  const copyAddress = async () => {
    if (account?.address) {
      try {
        await navigator.clipboard.writeText(account.address.toString())
      } catch (err) {
        console.error('Failed to copy address:', err)
      }
    }
  }

  if (connected && account?.address) {
    const addressString = account.address.toString()
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="gap-2">
            <Wallet className="h-4 w-4" />
            {addressString.slice(0, 6)}...{addressString.slice(-4)}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <div className="flex items-center gap-2 p-2">
            {connectedWallet?.icon && (
              <img src={connectedWallet.icon} alt={connectedWallet.name} className="h-6 w-6" />
            )}
            <div>
              <div className="font-medium">{connectedWallet?.name || 'Unknown Wallet'}</div>
              <div className="text-sm text-muted-foreground">
                {addressString.slice(0, 8)}...{addressString.slice(-8)}
              </div>
            </div>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={copyAddress} className="gap-2">
            <Copy className="h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          {connectedWallet?.url && (
            <DropdownMenuItem asChild>
              <a 
                href={connectedWallet.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open Wallet
              </a>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={disconnect} className="gap-2">
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  }

  return (
    <>
      <Button className="gap-2" onClick={() => setIsModalOpen(true)}>
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
      
      <WalletModal 
        open={isModalOpen} 
        onOpenChange={setIsModalOpen} 
      />
    </>
  )
}
