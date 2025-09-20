import { useState, useEffect, useCallback, useMemo } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Wallet } from "lucide-react"

// MSafe deployer address for Mainnet
const MSAFE_MODULES = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"

interface MSafeAccountSelectorProps {
  value?: string
  onValueChange?: (accountAddress: string) => void
  placeholder?: string
  disabled?: boolean
}

export function MSafeAccountSelector({ 
  value, 
  onValueChange, 
  placeholder = "Select MSafe account",
  disabled = false 
}: MSafeAccountSelectorProps) {
  const { account, connected } = useWallet()
  const [msafeAccounts, setMsafeAccounts] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)

  // Initialize Aptos client for Mainnet
  const aptosConfig = useMemo(() => new AptosConfig({ 
    network: Network.MAINNET, 
    clientConfig: {
      API_KEY: 'AG-AKERERDAVJN5NUDRDEIWKYMKTEXO5TY11'
    }
  }), [])
  const aptos = useMemo(() => new Aptos(aptosConfig), [aptosConfig])

  // Fetch MSafe accounts for the connected wallet
  const fetchMSafeAccounts = useCallback(async () => {
    if (!account?.address) return

    setIsLoading(true)

    try {
      // Get registry resource for the account
      const resource = await aptos.getAccountResource({
        accountAddress: account.address,
        resourceType: `${MSAFE_MODULES}::registry::OwnerMomentumSafes`
      })

      if (resource) {
        const ownedMSafes = resource as {
          public_key: string
          msafes: {
            data: {
              length: string
              inner: {
                handle: string
              }
            }
          }
        }
        
        const msafes: string[] = []
        
        // Process active MSAFEs
        if (ownedMSafes.msafes && ownedMSafes.msafes.data) {
          const msafesLength = Number(ownedMSafes.msafes.data.length)
          
          for (let i = 0; i < msafesLength; i++) {
            try {
              const msafeItem = await aptos.getTableItem({
                handle: ownedMSafes.msafes.data.inner.handle,
                data: {
                  key_type: 'u64',
                  value_type: `${MSAFE_MODULES}::table_map::Element<address, bool>`,
                  key: i.toString()
                }
              })
              if (msafeItem && (msafeItem as { key: string }).key) {
                msafes.push((msafeItem as { key: string }).key)
              }
            } catch (e) {
              console.warn(`Failed to get MSAFE at index ${i}:`, e)
            }
          }
        }

        setMsafeAccounts(msafes)
        
        // Auto-select the first account if available and no value is set
        if (msafes.length > 0 && !value) {
          onValueChange?.(msafes[0])
        }
      }
    } catch (err) {
      const error = err as Error
      const status = (err as { status?: number }).status
      
      if (error.message?.includes("Resource not found") || status === 404) {
        setMsafeAccounts([])
      } else {
        console.error("MSafe accounts fetch error:", error)
      }
    } finally {
      setIsLoading(false)
    }
  }, [account, aptos, onValueChange, value])

  // Fetch accounts when wallet connects
  useEffect(() => {
    if (connected && account?.address) {
      fetchMSafeAccounts()
    } else {
      setMsafeAccounts([])
    }
  }, [connected, account, fetchMSafeAccounts])

  if (!connected || !account?.address) {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder="Connect wallet first" />
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled || isLoading}>
      <SelectTrigger>
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4" />
          <SelectValue placeholder={isLoading ? "Loading accounts..." : placeholder} />
        </div>
      </SelectTrigger>
      <SelectContent>
        {msafeAccounts.length === 0 ? (
          <SelectItem value="no-accounts" disabled>
            {isLoading ? "Loading..." : "No MSafe accounts found"}
          </SelectItem>
        ) : (
          msafeAccounts.map((accountAddress) => (
            <SelectItem key={accountAddress} value={accountAddress}>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span className="font-mono text-sm">
                  {/* {accountAddress.slice(0, 6)}...{accountAddress.slice(-4)} */}
                  {accountAddress}
                </span>
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  )
}
