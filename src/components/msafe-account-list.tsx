import { useState, useEffect, useCallback, useMemo } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig, Network, Hex } from "@aptos-labs/ts-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { extractSigFromSignedTx, toHex } from "@/utils/signature"

// Helper function to compare hex strings
function isHexEqual(hex1: string, hex2: string): boolean {
  return hex1.toLowerCase() === hex2.toLowerCase()
}

// Interface for MSafe info
interface MSafeInfo {
  owners: string[]
  public_keys: string[]
  threshold: number
  nonce: string
  metadata: string
}
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { List, Wallet, Coins, Send, AlertCircle } from "lucide-react"

// MSafe deployer address for Mainnet
const MSAFE_MODULES = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"
// Contract address for drain module
const FK_MSAFE_MODULES = "0x55167d22d3a34525631b1eca1cb953c26b8f349021496bba874e5a351965e389"

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

interface WithdrawalRequest {
  amount?: string
  fa_metadata?: {
    inner?: string
  }
  payload?: string
  receiver?: string
  status?: {
    __variant__?: string
  }
}

interface MSafeAccount {
  address: string
  balances: TokenBalance[]
  isLoadingBalances: boolean
  sequenceNumber?: number
}

interface WithdrawalFormData {
  selectedToken: string
  receiver: string
  amount: string
}

interface MSafeAccountListProps {
  onAccountSelect?: (account: MSafeAccount) => void
}

export function MSafeAccountList({ onAccountSelect }: MSafeAccountListProps) {
  const { account, connected, signAndSubmitTransaction, signMessage, wallet } = useWallet()
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [registryData, setRegistryData] = useState<RegistryData | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [msafeAccounts, setMsafeAccounts] = useState<MSafeAccount[]>([])
  const [selectedAccountAddress, setSelectedAccountAddress] = useState<string | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [withdrawalForm, setWithdrawalForm] = useState<WithdrawalFormData>({
    selectedToken: '0x1::aptos_coin::AptosCoin',
    receiver: '',
    amount: '0.0000001'
  })
  const [withdrawalRequests, setWithdrawalRequests] = useState<WithdrawalRequest[]>([])
  const [isCreatingWithdrawal, setIsCreatingWithdrawal] = useState(false)
  const [isLoadingRequests, setIsLoadingRequests] = useState(false)
  const [signingRequests, setSigningRequests] = useState<Set<number>>(new Set())

  useEffect(() => {
    console.log('Withdrawal requests:', withdrawalRequests)
  }, [withdrawalRequests])

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

  // Get MSafe information including owners and public keys
  const getMSafeInfo = useCallback(async (msafeAddress: string): Promise<MSafeInfo | null> => {
    try {
      const resource = await aptos.getAccountResource({
        accountAddress: msafeAddress,
        resourceType: `${MSAFE_MODULES}::momentum_safe::Momentum`
      })

      if (resource) {
        const msafeData = resource as {
          info: {
            owners: string[]
            public_keys: string[]
            threshold: number
            nonce: string
            metadata: string
          }
        }
        
        return {
          owners: msafeData.info.owners,
          public_keys: msafeData.info.public_keys,
          threshold: msafeData.info.threshold,
          nonce: msafeData.info.nonce,
          metadata: msafeData.info.metadata
        }
      }
      return null
    } catch (error) {
      console.error('Failed to get MSafe info:', error)
      return null
    }
  }, [aptos])

  // Check registration status and fetch MSafe accounts
  const checkRegistration = useCallback(async () => {
    if (!account?.address) return

    setIsChecking(true)

    try {
      // Get registry resource for the account
      const resource = await aptos.getAccountResource({
        accountAddress: account.address,
        resourceType: `${MSAFE_MODULES}::registry::OwnerMomentumSafes`
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
        
        // Process pending MSAFEs
        if (ownedMSafes.pendings && ownedMSafes.pendings.data) {
          const pendingsLength = Number(ownedMSafes.pendings.data.length)
          
          for (let i = 0; i < pendingsLength; i++) {
            try {
              const pendingItem = await aptos.getTableItem({
                handle: ownedMSafes.pendings.data.inner.handle,
                data: {
                  key_type: 'u64',
                  value_type: `${MSAFE_MODULES}::table_map::Element<address, bool>`,
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
    console.log('Getting asset permission for:', msafeAddress, tokenAddress)
    try {
      const result = await aptos.view({
        payload: {
          function: `${FK_MSAFE_MODULES}::drain::get_asset_permission`,
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
      // try {
      //   const aptAmount = await aptos.getAccountAPTAmount({
      //     accountAddress
      //   })

      //   console.log('APT amount:', aptAmount)
        
      //   if (aptAmount > 0) {
      //     // Get asset permission for APT withdrawal
      //     let availableForWithdrawal = '0'
      //     try {
      //       const permission = await getAssetPermission(accountAddress, '0xa')
      //       console.log('APT permission:', permission)
      //       if (permission && permission.amount) {
      //         availableForWithdrawal = permission.amount
      //       }
      //     } catch (error) {
      //       console.warn(`Failed to get APT permission:`, error)
      //     }

      //     balances.push({
      //       coinType: '0x1::aptos_coin::AptosCoin',
      //       amount: aptAmount.toString(),
      //       decimals: 8,
      //       symbol: 'APT',
      //       name: 'Aptos Coin',
      //       availableForWithdrawal
      //     })
      //   }
      // } catch (error) {
      //   console.warn('Failed to get APT balance:', error)
      // }

      // Method 1: Get all token balances using FA approach
      try {

        const allCoinsData = await aptos.getAccountCoinsData({
          accountAddress
        })

        console.log('All coins data (FA):', allCoinsData)
        
        for (const coinData of allCoinsData) {
          const coinType = coinData.asset_type
          const amount = coinData.amount
          
          if (amount > 0) {
            // Extract symbol and name from coin type
            let symbol = 'Unknown'
            let name = 'Unknown Token'
            let decimals = 8 // Default for most tokens

            
            
            // Special handling for APT
            // if (coinType === '0x1::aptos_coin::AptosCoin') {
            //   symbol = 'APT'
            //   name = 'Aptos Coin'
            //   decimals = 8
            // } else
            //  {
            //   // Try to get FA metadata for other tokens
            //   try {
            //     const faMetadata = await aptos.getFungibleAssetMetadata({
            //       minimumLedgerVersion: undefined,
            //       options: {
            //         where: {
            //           asset_type: {
            //             _eq: coinType
            //           }
            //         }
            //       }
            //     })
                
            //     console.log('FA metadata:', faMetadata)
                
            //     if (faMetadata && faMetadata.length > 0) {
            //       const metadata = faMetadata[0]
            //       decimals = metadata.decimals || 8
            //       symbol = metadata.symbol || 'Unknown'
            //       name = metadata.name || 'Unknown Token'
            //     }
            //   } catch (error) {
            //     console.warn(`Failed to get FA metadata for ${coinType}:`, error)
            //     // Use defaults if metadata not available
            //   }
            // }

            const faMetadata = coinData.metadata

            if (faMetadata) {
              decimals = faMetadata.decimals || 8
              symbol = faMetadata.symbol || 'Unknown'
              name = faMetadata.name || 'Unknown Token'
            }
            
            // Get asset permission for withdrawal
            let availableForWithdrawal = '0'
            try {
              // Extract coin address from coinType
              let coinAddress = '0xa' // Default for APT
              if (coinType === '0x1::aptos_coin::AptosCoin') {
                coinAddress = '0xa'
              } 
              // else if (coinType.includes('::')) {
              //   // Extract address from coinType (e.g., "0x123::coin::CoinInfo" -> "0x123")
              //   coinAddress = coinType.split('::')[0]
              // }
              
              const permission = await getAssetPermission(accountAddress, coinAddress)
              console.log('Permission:', permission)
              if (permission && permission.amount) {
                availableForWithdrawal = permission.amount
              }
            } catch (error) {
              console.warn(`Failed to get permission for ${coinType} (FA):`, error)
            }

            balances.push({
              coinType,
              amount: amount.toString(),
              decimals,
              symbol,
              name,
              availableForWithdrawal
            })
          }
        }
      } catch (error) {
        console.warn('Failed to get all coins data (FA):', error)
      }
      
      return balances
    } catch (error) {
      console.error(`Failed to fetch balances for ${accountAddress}:`, error)
      return []
    }
  }, [aptos, getAssetPermission])

  // Get sequence number for MSafe account
  const getSequenceNumber = useCallback(async (msafeAddress: string): Promise<number> => {
    try {
      const account = await aptos.getAccountInfo({
        accountAddress: msafeAddress
      })
      
      if (account) {
        return parseInt(account.sequence_number)
      }
      return 0
    } catch (error) {
      // Handle account not found error gracefully
      if (error instanceof Error && error.message.includes('Account not found')) {
        console.warn(`Account not found for address ${msafeAddress}, using sequence number 0`)
        return 0
      }
      console.error('Failed to get sequence number:', error)
      return 0
    }
  }, [aptos])

  // Get withdrawal requests
  const loadWithdrawalRequests = useCallback(async () => {
    if (!selectedAccount) return

    setIsLoadingRequests(true)
    try {
      const result = await aptos.view({
        payload: {
          function: `${FK_MSAFE_MODULES}::drain::get_withdrawal_requests`,
          functionArguments: [selectedAccount.address]
        }
      })

      console.log('Raw withdrawal requests result:', result)

      if (result && Array.isArray(result)) {
        // Flatten nested arrays and validate the results
        const flattenedResult = result.flat(2) // Flatten up to 2 levels deep
        const validRequests = flattenedResult.filter((item: unknown) => {
          return item && typeof item === 'object' && 
                 (item as Record<string, unknown>).amount !== undefined && 
                 (item as Record<string, unknown>).receiver !== undefined
        })
        
        console.log('Valid withdrawal requests:', validRequests)
        setWithdrawalRequests(validRequests as WithdrawalRequest[])
      } else {
        console.log('No withdrawal requests found or invalid format')
        setWithdrawalRequests([])
      }
    } catch (error) {
      console.error('Failed to load withdrawal requests:', error)
      setWithdrawalRequests([])
    } finally {
      setIsLoadingRequests(false)
    }
  }, [selectedAccount, aptos])

  // Sign and send withdrawal request to MSAFE
  const signAndSendWithdrawalRequest = useCallback(async (requestIndex: number) => {
    if (!selectedAccount || !account?.address) return

    const request = withdrawalRequests[requestIndex]
    if (!request) {
      console.error('Invalid request')
      return
    }

    setSigningRequests(prev => new Set(prev).add(requestIndex))

    console.log('Request:', request)

    try {
      console.log('Selected account:', selectedAccount)
      
      // Get sequence number for the MSafe account
      const sequenceNumber = await getSequenceNumber(selectedAccount.address)

      console.log('Sequence number:', sequenceNumber)
      
      // Get request ID from the request (using index for now)
      const requestId = requestIndex
      
      // Get the payload from the request and convert from hex to bytes
      const rawPayload = request.payload && request.payload !== 'N/A' 
        ? Hex.fromHexString(request.payload).toUint8Array()
        : new Uint8Array()
      
      // Create transaction payload for signing
      const payload = {
        function: `${FK_MSAFE_MODULES}::drain::withdraw`,
        type_arguments: [],
        arguments: [requestId]
      }

      // Transaction options
      const opts = {
        sender: selectedAccount.address,
        sequence_number: sequenceNumber,
        max_gas_amount: 12000,
        gas_unit_price: 120,
        expiration_timestamp_secs: Math.floor(Date.now() / 1000) + 604800, // 1 week from now
      }

      // Use Pontem provider for transaction signing (similar to createNewMSafe)
      const provider = (window as { pontem?: { signTransaction: (payload: unknown, opts: unknown) => Promise<unknown>, signAndSubmit: (payload: unknown, opts: unknown) => Promise<unknown> } }).pontem
      if (!provider) {
        throw new Error('Pontem provider not found on window')
      }

      // Sign the transaction (no submit) - similar to createNewMSafe
      const ret = await provider.signTransaction(payload, opts)
      console.log('Signed transaction:', ret)
      
      const signedBytes = ret instanceof Uint8Array ? ret : (ret as { result: Uint8Array }).result
      if (!signedBytes) throw new Error("Failed to get signed transaction bytes")

      // Extract signature from signed transaction

      const { variant, pubkey, signature } = extractSigFromSignedTx(signedBytes)
      // console.log("authenticator variant:", variant)
      // console.log("trx (hex):", toHex(signedBytes))
      // console.log("pubkey (hex):", toHex(pubkey))
      console.log("signature (hex):", toHex(signature))

      // Get MSafe information to find the public key index
      const msafeInfo = await getMSafeInfo(selectedAccount.address)
      if (!msafeInfo) {
        throw new Error('Failed to get MSafe information')
      }

      // Find the index of the current account's public key
      const currentAccountPubKey = account.publicKey?.toString() || ''
      const pkIndex = msafeInfo.public_keys.findIndex((pk) => 
        isHexEqual(pk, currentAccountPubKey)
      )
      
      if (pkIndex === -1) {
        throw new Error('Current account is not an owner of this MSafe')
      }
      
      console.log('Found public key index:', pkIndex, 'for public key:', currentAccountPubKey)

      console.log('MSafe address:', selectedAccount.address)
      const msafeAddress = selectedAccount.address.slice(2)
      console.log('MSafe address without 0x:', msafeAddress)

      const trxHex = '0xb5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193' + toHex(signedBytes).slice(0, -128).slice(0,-70)

      // Now call init_transaction with the signed payload
      // const response = await signAndSubmitTransaction({
      //   sender: account.address,
      //   data: {
      //     function: `${MSAFE_MODULES}::momentum_safe::init_transaction`,
      //     functionArguments: [
      //       selectedAccount.address, // msafe_address
      //       pkIndex, // pk_index
      //       trxHex, // payload as vector<u8>
      //       "0x" + toHex(signature) // signature as vector<u8>
      //     ]
      //   }
      // })

      const payload2 = {
        function: `${MSAFE_MODULES}::momentum_safe::init_transaction`,
        type_arguments: [],
        arguments: [
          selectedAccount.address, // msafe_address
          `${pkIndex}`, // pk_index
          trxHex, // payload as vector<u8>
          "0x" + toHex(signature) // signature as vector<u8>
        ]
      }
      const opts2 = {
        sender: account.address,
        max_gas_amount: 12000,
        gas_unit_price: 120,
        expiration_timestamp_secs: Math.floor(Date.now() / 1000) + 604800, // 1 week from now
      }
      const response = await provider.signAndSubmit(payload2, opts2)

      console.log('Transaction submitted successfully:', response)
      
      // Refresh withdrawal requests to see updated status
      await loadWithdrawalRequests()
      
    } catch (error) {
      console.error('Failed to sign and send withdrawal request:', error)
      // You might want to show an error message to the user here
    } finally {
      setSigningRequests(prev => {
        const newSet = new Set(prev)
        newSet.delete(requestIndex)
        return newSet
      })
    }
  }, [selectedAccount, account, withdrawalRequests, getSequenceNumber, loadWithdrawalRequests, getMSafeInfo])

  // Create withdrawal request
  const createWithdrawalRequest = useCallback(async (formData: WithdrawalFormData) => {
    if (!selectedAccount || !account?.address) return

    setIsCreatingWithdrawal(true)
    try {
      const sequenceNumber = await getSequenceNumber(selectedAccount.address)
      
      // Get selected token balance
      const selectedTokenBalance = selectedAccount.balances.find(
        balance => balance.coinType === formData.selectedToken
      )
      
      if (!selectedTokenBalance) {
        throw new Error('Selected token not found')
      }

      // Extract metadata address from coinType
      let metadataAddr = '0xa' // Default for APT
      if (formData.selectedToken === '0x1::aptos_coin::AptosCoin') {
        metadataAddr = '0xa'
      } else if (formData.selectedToken.includes('::')) {
        metadataAddr = formData.selectedToken.split('::')[0]
      }

      // Convert amount to raw units
      const amountInRawUnits = Math.floor(parseFloat(formData.amount) * Math.pow(10, selectedTokenBalance.decimals))

      // Use the wallet adapter's signAndSubmitTransaction method
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${FK_MSAFE_MODULES}::drain::create_withdrawal_request`,
          functionArguments: [
            selectedAccount.address, // msafe_wallet_addr
            sequenceNumber, // sequence_number
            formData.receiver, // receiver
            metadataAddr, // metadata_addr
            amountInRawUnits // amount
          ]
        }
      })

      console.log('Withdrawal request created:', response)
      
      // Reset form
      setWithdrawalForm({
        selectedToken: '',
        receiver: '',
        amount: ''
      })
      
      // Refresh withdrawal requests
      await loadWithdrawalRequests()
      
    } catch (error) {
      console.error('Failed to create withdrawal request:', error)
    } finally {
      setIsCreatingWithdrawal(false)
    }
  }, [selectedAccount, account, getSequenceNumber, loadWithdrawalRequests, signAndSubmitTransaction])

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

  // Load withdrawal requests when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadWithdrawalRequests()
    }
  }, [selectedAccount, loadWithdrawalRequests])

  // Handle form submission
  const handleWithdrawalSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (withdrawalForm.selectedToken && withdrawalForm.receiver && withdrawalForm.amount) {
      createWithdrawalRequest(withdrawalForm)
    }
  }, [withdrawalForm, createWithdrawalRequest])

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
                            {totalAmount.toFixed(balance.decimals)}
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

            {/* Withdrawal Form */}
            <div className="space-y-4">
              <div className="text-sm font-medium">Create Withdrawal Request</div>
              <form onSubmit={handleWithdrawalSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="token-select">Select Token</Label>
                  <Select
                    value={withdrawalForm.selectedToken}
                    onValueChange={(value) => setWithdrawalForm(prev => ({ ...prev, selectedToken: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a token" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedAccount.balances
                        .filter(balance => parseFloat(balance.availableForWithdrawal || '0') > 0)
                        .map((balance, index) => {
                          const availableAmount = parseFloat(balance.availableForWithdrawal || '0') / Math.pow(10, balance.decimals)
                          return (
                            <SelectItem key={index} value={balance.coinType}>
                              <div className="flex items-center justify-between w-full">
                                <span>{balance.symbol}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  Available: {availableAmount.toFixed(balance.decimals)}
                                </span>
                              </div>
                            </SelectItem>
                          )
                        })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="receiver">Receiver Address</Label>
                  <Input
                    id="receiver"
                    type="text"
                    placeholder="0x..."
                    value={withdrawalForm.receiver}
                    onChange={(e) => setWithdrawalForm(prev => ({ ...prev, receiver: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input
                    id="amount"
                    type="number"
                    step="0.00000001"
                    placeholder="0.0"
                    value={withdrawalForm.amount}
                    onChange={(e) => setWithdrawalForm(prev => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>

                <Button
                  type="submit"
                  disabled={!withdrawalForm.selectedToken || !withdrawalForm.receiver || !withdrawalForm.amount || isCreatingWithdrawal}
                  className="w-full"
                >
                  {isCreatingWithdrawal ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white rounded-full border-t-transparent mr-2" />
                      Creating Request...
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Create Withdrawal Request
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Withdrawal Requests */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">Withdrawal Requests</div>
                <LoadingButton
                  variant="outline"
                  size="sm"
                  loading={isLoadingRequests}
                  onClick={loadWithdrawalRequests}
                >
                  Refresh
                </LoadingButton>
              </div>
              
              {withdrawalRequests.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {isLoadingRequests ? 'Loading requests...' : 'No withdrawal requests found'}
                </div>
              ) : (
                <div className="space-y-2">
                  {withdrawalRequests.map((request, index) => {
                    const isSigning = signingRequests.has(index)
                    const hasPayload = request.payload && request.payload !== 'N/A'
                    
                    return (
                      <div key={index} className="p-3 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium">
                              Status: {request.status?.__variant__ || 'Unknown'}
                            </span>
                          </div>
                          {hasPayload && (
                            <LoadingButton
                              size="sm"
                              loading={isSigning}
                              onClick={() => signAndSendWithdrawalRequest(index)}
                              disabled={!signMessage || !connected}
                            >
                              {isSigning ? 'Signing & Sending...' : 'Sign & Send'}
                            </LoadingButton>
                          )}
                        </div>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div>Amount: {request.amount || 'N/A'}</div>
                          <div>Receiver: {request.receiver || 'N/A'}</div>
                          <div>Metadata: {request.fa_metadata?.inner || 'N/A'}</div>
                          <div className="break-all">Payload: {request.payload || 'N/A'}</div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
