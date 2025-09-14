import { useState, useEffect, useCallback, useMemo } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { List, Wallet, Coins } from "lucide-react"

// MSafe deployer address for Mainnet
const MSAFE_MODULES_ACCOUNT = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"

interface RegistryData {
  publicKey: string
  pendings: string[]
  msafes: string[]
}

interface TokenBalance {
  coinType: string
  amount: string
  decimals: number
  symbol?: string
  name?: string
  availableForWithdrawal?: string
}

interface AssetPermission {
  amount: string
}

interface MSafeAccount {
  address: string
  balances: TokenBalance[]
  isLoadingBalances: boolean
}

interface MSafeAccountListProps {
  onAccountSelect?: (account: MSafeAccount) => void
}

export function MSafeAccountList({ onAccountSelect }: MSafeAccountListProps) {
  const { account, connected } = useWallet()
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [registryData, setRegistryData] = useState<RegistryData | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [msafeAccounts, setMsafeAccounts] = useState<MSafeAccount[]>([])
  const [selectedAccountAddress, setSelectedAccountAddress] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)

  // Computed selected account from the address
  const selectedAccount = useMemo(() => {
    if (!selectedAccountAddress) return null
    return msafeAccounts.find(account => account.address === selectedAccountAddress) || null
  }, [selectedAccountAddress, msafeAccounts])

  // Initialize Aptos client for Mainnet
  const aptosConfig = useMemo(() => new AptosConfig({ 
    network: Network.MAINNET, 
    clientConfig: {
      API_KEY: 'AG-AKERERDAVJN5NUDRDEIWKYMKTEXO5TY11'
    }
  }), [])
  const aptos = useMemo(() => new Aptos(aptosConfig), [aptosConfig])

  // Contract address for drain module
  const DRAIN_CONTRACT = "0x55167d22d3a34525631b1eca1cb953c26b8f349021496bba874e5a351965e389"

  // Check registration status and fetch MSafe accounts
  const checkRegistration = useCallback(async () => {
    if (!account?.address) return

    setIsChecking(true)

    try {
      // Get registry resource for the account
      const resource = await aptos.getAccountResource({
        accountAddress: account.address,
        resourceType: `${MSAFE_MODULES_ACCOUNT}::registry::OwnerMomentumSafes`
      })

      if (resource) {
        const ownedMSafes = resource as {
          public_key: string
          pendings: {
            data: {
              length: string
              inner: {
                handle: string
              }
            }
          }
          msafes: {
            data: {
              length: string
              inner: {
                handle: string
              }
            }
          }
        }
        
        const publicKey = ownedMSafes.public_key
        const msafes: string[] = []
        const pendings: string[] = []
        
        // Process active MSAFEs
        if (ownedMSafes.msafes && ownedMSafes.msafes.data) {
          const msafesLength = Number(ownedMSafes.msafes.data.length)
          
          for (let i = 0; i < msafesLength; i++) {
            try {
              const msafeItem = await aptos.getTableItem({
                handle: ownedMSafes.msafes.data.inner.handle,
                data: {
                  key_type: 'u64',
                  value_type: `${MSAFE_MODULES_ACCOUNT}::table_map::Element<address, bool>`,
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
        
        // Process pending MSAFEs
        if (ownedMSafes.pendings && ownedMSafes.pendings.data) {
          const pendingsLength = Number(ownedMSafes.pendings.data.length)
          
          for (let i = 0; i < pendingsLength; i++) {
            try {
              const pendingItem = await aptos.getTableItem({
                handle: ownedMSafes.pendings.data.inner.handle,
                data: {
                  key_type: 'u64',
                  value_type: `${MSAFE_MODULES_ACCOUNT}::table_map::Element<address, bool>`,
                  key: i.toString()
                }
              })
              if (pendingItem && (pendingItem as { key: string }).key) {
                pendings.push((pendingItem as { key: string }).key)
              }
            } catch (e) {
              console.warn(`Failed to get pending MSAFE at index ${i}:`, e)
            }
          }
        }

        const registryData: RegistryData = {
          publicKey: publicKey,
          pendings: pendings,
          msafes: msafes
        }
        
        setRegistryData(registryData)
        setIsRegistered(true)
        setPendingCount(pendings.length)

        // Create MSafe account objects - only active accounts
        const accounts: MSafeAccount[] = msafes.map(address => ({
          address,
          balances: [],
          isLoadingBalances: false
        }))
        
        setMsafeAccounts(accounts)
        
        // Auto-select the first account if available
        if (accounts.length > 0) {
          setSelectedAccountAddress(accounts[0].address)
          onAccountSelect?.(accounts[0])
        }
      }
    } catch (err) {
      const error = err as Error
      const status = (err as { status?: number }).status
      
      if (error.message?.includes("Resource not found") || status === 404) {
        setIsRegistered(false)
        setRegistryData(null)
        setMsafeAccounts([])
      } else {
        console.error("Registration check error:", error)
      }
    } finally {
      setIsChecking(false)
    }
  }, [account, aptos, onAccountSelect])

  // Get asset permission for withdrawal
  const getAssetPermission = useCallback(async (msafeAddress: string, tokenAddress: string): Promise<AssetPermission | null> => {
    try {
      const result = await aptos.view({
        payload: {
          function: `${DRAIN_CONTRACT}::drain::get_asset_permission`,
          functionArguments: [msafeAddress, tokenAddress]
        }
      })

      if (result && result.length > 0) {
        return {
          amount: result[0] as string
        }
      }
      
      return null
    } catch (error) {
      console.warn(`Failed to get asset permission for ${tokenAddress}:`, error)
      return null
    }
  }, [aptos])

  // Fetch token balances for a specific account
  const fetchAccountBalances = useCallback(async (accountAddress: string) => {
    try {

      console.log('Fetching balances for account:', accountAddress)

      const balances: TokenBalance[] = []
      
      // Method 1: Get APT balance using the direct method
      try {
        const aptAmount = await aptos.getAccountAPTAmount({
          accountAddress
        })

        console.log('APT amount:', aptAmount)
        
        if (aptAmount > 0) {
          // Get asset permission for APT withdrawal
          let availableForWithdrawal = '0'
          try {
            const permission = await getAssetPermission(accountAddress, '0xa')
            console.log('APT permission:', permission)
            if (permission && permission.amount) {
              availableForWithdrawal = permission.amount
            }
          } catch (error) {
            console.warn(`Failed to get APT permission:`, error)
          }

          balances.push({
            coinType: '0x1::aptos_coin::AptosCoin',
            amount: aptAmount.toString(),
            decimals: 8,
            symbol: 'APT',
            name: 'Aptos Coin',
            availableForWithdrawal
          })
        }
      } catch (error) {
        console.warn('Failed to get APT balance:', error)
      }
      
      // Method 2: Get other token balances from Coin resources
      const resources = await aptos.getAccountResources({
        accountAddress
      })

      console.log('Coin resources:', resources)
      
      // Look for coin stores (excluding APT which we already handled)
      for (const resource of resources) {
        if (resource.type.includes('0x1::coin::CoinStore<') && !resource.type.includes('0x1::aptos_coin::AptosCoin')) {
          const coinType = resource.type.match(/0x1::coin::CoinStore<(.+)>/)?.[1]
          if (coinType) {
            const data = resource.data as { coin: { value: string } }
            const amount = data.coin.value
            
            // Extract symbol and name from coin type
            let symbol = 'Unknown'
            let name = 'Unknown Token'
            let decimals = 8 // Default for most tokens
            
            if (coinType.includes('0x1::coin::CoinInfo<')) {
              // Try to get coin info
              try {
                const coinInfoResource = await aptos.getAccountResource({
                  accountAddress: coinType.split('<')[1].split('>')[0],
                  resourceType: `${coinType.split('<')[1].split('>')[0]}::coin::CoinInfo`
                })
                
                if (coinInfoResource) {
                  const coinInfo = coinInfoResource.data as {
                    decimals: number
                    symbol: string
                    name: string
                  }
                  decimals = coinInfo.decimals
                  symbol = coinInfo.symbol
                  name = coinInfo.name
                }
              } catch {
                // Use defaults if coin info not available
              }
            }
            
            if (amount !== '0') {
              // Get asset permission for withdrawal
              let availableForWithdrawal = '0'
              try {
                const permission = await getAssetPermission(accountAddress, coinType)
                if (permission && permission.amount) {
                  availableForWithdrawal = permission.amount
                }
              } catch (error) {
                console.warn(`Failed to get permission for ${coinType}:`, error)
              }

              balances.push({
                coinType,
                amount,
                decimals,
                symbol,
                name,
                availableForWithdrawal
              })
            }
          }
        }
      }

      // Method 2: Get owned tokens (NFTs and other tokens)
      // try {
      //   const ownedTokens = await aptos.getAccountOwnedTokens({
      //     accountAddress
      //   })

      //   console.log('Owned tokens:', ownedTokens)

      //   // Process owned tokens
      //   for (const token of ownedTokens) {
      //     // Skip if already processed as a coin
      //     const isAlreadyProcessed = balances.some(balance => 
      //       balance.coinType === token.token_type
      //     )
          
      //     if (!isAlreadyProcessed && token.amount !== '0') {
      //       // Extract token info
      //       let symbol = 'Unknown'
      //       let name = 'Unknown Token'
      //       let decimals = 8

      //       // Try to get token metadata
      //       if (token.current_token_data) {
      //         name = token.current_token_data.token_name || 'Unknown Token'
      //         symbol = token.current_token_data.token_properties?.symbol || 'Unknown'
      //       }

      //       // Try to get coin info for fungible tokens
      //       if (token.token_type.includes('0x1::coin::CoinInfo<')) {
      //         try {
      //           const coinInfoResource = await aptos.getAccountResource({
      //             accountAddress: token.token_type.split('<')[1].split('>')[0],
      //             resourceType: `${token.token_type.split('<')[1].split('>')[0]}::coin::CoinInfo`
      //           })
                
      //           if (coinInfoResource) {
      //             const coinInfo = coinInfoResource.data as {
      //               decimals: number
      //               symbol: string
      //               name: string
      //             }
      //             decimals = coinInfo.decimals
      //             symbol = coinInfo.symbol
      //             name = coinInfo.name
      //           }
      //         } catch {
      //           // Use defaults if coin info not available
      //         }
      //       }

      //       balances.push({
      //         coinType: token.token_type,
      //         amount: token.amount,
      //         decimals,
      //         symbol,
      //         name
      //       })
      //     }
      //   }
      // } catch (tokenError) {
      //   console.warn('Failed to fetch owned tokens:', tokenError)
      //   // Continue with coin resources only
      // }
      
      return balances
    } catch (error) {
      console.error(`Failed to fetch balances for ${accountAddress}:`, error)
      return []
    }
  }, [aptos, getAssetPermission])

  // Load balances for selected account
  const loadAccountBalances = useCallback(async (account: MSafeAccount) => {
    if (account.isLoadingBalances) return

    setMsafeAccounts(prev => prev.map(acc => 
      acc.address === account.address 
        ? { ...acc, isLoadingBalances: true }
        : acc
    ))

    try {
      const balances = await fetchAccountBalances(account.address)

      console.log('Balances:', balances)
      
      setMsafeAccounts(prev => prev.map(acc => 
        acc.address === account.address 
          ? { ...acc, balances, isLoadingBalances: false }
          : acc
      ))
    } catch (error) {
      console.error('Failed to load balances:', error)
      setMsafeAccounts(prev => prev.map(acc => 
        acc.address === account.address 
          ? { ...acc, isLoadingBalances: false }
          : acc
      ))
    }
  }, [fetchAccountBalances])

  useEffect(() => {
    console.log('Selected account:', selectedAccountAddress)
  }, [selectedAccountAddress])

  // Load balances for selected account when it changes
  useEffect(() => {
    if (selectedAccount && selectedAccount.balances.length === 0 && !selectedAccount.isLoadingBalances) {
      loadAccountBalances(selectedAccount)
    }
  }, [selectedAccount, loadAccountBalances])

  // Handle account selection
  const handleAccountSelect = useCallback((account: MSafeAccount) => {
    setSelectedAccountAddress(account.address)
    onAccountSelect?.(account)
    
    // Load balances if not already loaded
    if (account.balances.length === 0 && !account.isLoadingBalances) {
      loadAccountBalances(account)
    }
  }, [onAccountSelect, loadAccountBalances])

  // Check registration when wallet connects
  useEffect(() => {
    if (connected && account?.address) {
      checkRegistration()
    } else {
      setIsRegistered(null)
      setRegistryData(null)
      setMsafeAccounts([])
      setSelectedAccountAddress(null)
    }
  }, [connected, account, checkRegistration])

  if (!connected || !account?.address) {
    return null
  }

  if (isChecking) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
            <span>Loading MSafe accounts...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (isRegistered === false) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <List className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              You need to register in MSafe to view your multisig wallets
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (msafeAccounts.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center space-y-2">
            <Wallet className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No MSafe wallets found
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            MSafe Accounts ({msafeAccounts.length})
            {pendingCount > 0 && (
              <span className="text-sm text-muted-foreground font-normal">
                • {pendingCount} pending hidden
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {msafeAccounts.map((msafeAccount) => (
            <div
              key={msafeAccount.address}
              className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                selectedAccountAddress === msafeAccount.address
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/20'
                  : 'border-border hover:border-blue-300'
              }`}
              onClick={() => handleAccountSelect(msafeAccount)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-sm truncate">
                        {msafeAccount.address}
                      </span>
                    </div>
                    {msafeAccount.balances.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Coins className="h-3 w-3" />
                        <span>{msafeAccount.balances.length} tokens</span>
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAccountSelect(msafeAccount)
                  }}
                >
                  Select
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Selected Account Details */}
      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Account Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="text-sm font-medium">Address</div>
              <div className="p-2 bg-muted rounded text-xs font-mono break-all">
                {selectedAccount.address}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Token Balances</div>
                <LoadingButton
                  variant="outline"
                  size="sm"
                  loading={selectedAccount.isLoadingBalances}
                  onClick={() => loadAccountBalances(selectedAccount)}
                >
                  Refresh
                </LoadingButton>
              </div>
              
              {selectedAccount.balances.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {selectedAccount.isLoadingBalances ? 'Loading balances...' : 'No tokens found'}
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedAccount.balances.map((balance, index) => {
                    const totalAmount = parseFloat(balance.amount) / Math.pow(10, balance.decimals)
                    const availableAmount = parseFloat(balance.availableForWithdrawal || '0') / Math.pow(10, balance.decimals)
                    const isWithdrawable = parseFloat(balance.availableForWithdrawal || '0') > 0
                    
                    return (
                      <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{balance.symbol}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {balance.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-mono">
                            {totalAmount.toFixed(4)}
                          </div>
                          {isWithdrawable && (
                            <div className="text-xs text-green-600 dark:text-green-400">
                              Available: {availableAmount.toFixed(balance.decimals)}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Placeholder for future actions */}
            <div className="space-y-2">
              <div className="text-sm font-medium">Actions</div>
              <div className="p-4 border-2 border-dashed border-muted-foreground/25 rounded-lg text-center">
                <div className="text-sm text-muted-foreground">
                  Account actions will be available here
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  (Send transactions, manage permissions, etc.)
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
