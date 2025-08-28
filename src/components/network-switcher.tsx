import { useState, useEffect } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Network } from "@aptos-labs/ts-sdk"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { AlertTriangle, Wifi } from "lucide-react"

const CHAINID = 1;

export function NetworkSwitcher() {
  const { network, changeNetwork, connected, wallet } = useWallet()
  const [showModal, setShowModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [switchStatus, setSwitchStatus] = useState<{
    type: "info" | "success" | "warning" | null
    message: string
  }>({ type: null, message: "" })

  // Monitor network changes
  useEffect(() => {
    if (connected && network && network.name !== Network.MAINNET) {
      setShowModal(true)
    } else {
      setShowModal(false)
    }
  }, [connected, network])

  const handleSwitchToMainnet = async () => {
    setIsLoading(true)
    setSwitchStatus({ type: "info", message: "Switching to mainnet..." })

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((wallet as any)?.isPontem) {
        console.log('Switching to mainnet with Pontem')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const provider = (window as { pontem?: any }).pontem
        if (!provider) throw new Error("Pontem provider not found on window")
        await provider.switchNetwork?.(CHAINID)
      } else {
        await changeNetwork(Network.MAINNET)
      }

      setSwitchStatus({ 
        type: "success", 
        message: "Successfully switched to mainnet" 
      })
      
      // Close modal after successful switch
      setTimeout(() => {
        setShowModal(false)
        setSwitchStatus({ type: null, message: "" })
      }, 2000)
      
    } catch (error) {
      console.error("Failed to switch to mainnet:", error)
      setSwitchStatus({
        type: "warning",
        message: "Failed to switch network. Please try manually."
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDismiss = () => {
    setShowModal(false)
    setSwitchStatus({ type: null, message: "" })
  }

  if (!connected || !network) {
    return null
  }

  return (
    <Dialog open={showModal} onOpenChange={setShowModal}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-5 w-5" />
            Network Switch Required
          </DialogTitle>
          <DialogDescription>
            You're currently connected to <strong>{network.name}</strong>. 
            This app only works with Aptos Mainnet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Network Info */}
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Wifi className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <div className="text-sm">
              <span className="text-muted-foreground">Current network: </span>
              <span className="font-medium text-amber-700 dark:text-amber-300">{network.name}</span>
            </div>
          </div>

          {/* Status Indicator */}
          {switchStatus.type && (
            <StatusIndicator 
              type={switchStatus.type} 
              message={switchStatus.message} 
            />
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button 
              onClick={handleSwitchToMainnet}
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? "Switching..." : "Switch to Mainnet"}
            </Button>
            <Button 
              variant="outline" 
              onClick={handleDismiss}
              disabled={isLoading}
            >
              Dismiss
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            You can also switch networks manually in your wallet settings
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
