import { useState } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Copy, Check, ChevronDown, Wallet, Fingerprint } from "lucide-react"

export function WalletInfo() {
  const { account, network } = useWallet()
  const [showDetails, setShowDetails] = useState(false)
  const [copiedField, setCopiedField] = useState<string | null>(null)

  if (!account?.address || !account?.publicKey) {
    return null
  }

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const truncateAddress = (address: string, length = 6) => {
    return `${address.slice(0, length)}...${address.slice(-4)}`
  }

  return (
    <Card 
      className="border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20 cursor-pointer hover:bg-muted/50 transition-colors"
      onClick={() => setShowDetails(!showDetails)}
    >
      <CardHeader className="">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-green-500 rounded-lg shrink-0">
              <Wallet className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CardTitle className="text-lg">
                  Wallet Connected
                </CardTitle>
                {network && network?.name ? <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/80 dark:text-green-100 shrink-0 capitalize">
                  {network.name}
                </Badge> : null}
              </div>
              <CardDescription className="mt-1">
                {account.address ? truncateAddress(account.address.toString()) : 'No address'}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 m-auto bg-accent dark:bg-accent/30"
            onClick={(e) => {
              e.stopPropagation()
              setShowDetails(!showDetails)
            }}
          >
            <ChevronDown 
              className={`h-4 w-4 transition-transform duration-200 ${
                showDetails ? "scale-100" : "-scale-100"
              }`}
            />
          </Button>
        </div>
      </CardHeader>
      
      {showDetails && (
        <CardContent className="space-y-4 pt-0" onClick={(e) => e.stopPropagation()}>
          <div className="space-y-3">
            {/* Address */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium text-muted-foreground">
                  Wallet Address
                </label>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                  {account.address?.toString() || 'No address available'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => account.address && copyToClipboard(account.address.toString(), 'address')}
                  className="shrink-0"
                  disabled={!account.address}
                >
                  {copiedField === 'address' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Public Key */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Fingerprint className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium text-muted-foreground">
                  Public Key
                </label>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
                  {account.publicKey?.toString() || 'No public key available'}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => account.publicKey && copyToClipboard(account.publicKey.toString(), 'publicKey')}
                  className="shrink-0"
                  disabled={!account.publicKey}
                >
                  {copiedField === 'publicKey' ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
