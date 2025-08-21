import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export function WalletInfo() {
  const { account, network } = useWallet()

  if (!account) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Information</CardTitle>
        <CardDescription>
          Your connected wallet details
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Address
            </label>
            <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
              {account.address.toString()}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Public Key
            </label>
            <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm break-all">
              {account.publicKey.toString()}
            </div>
          </div>
        </div>
        {network && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Network
            </label>
            <div className="mt-1 p-3 bg-muted rounded-md">
              {network.name}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
