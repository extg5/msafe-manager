import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig, Deserializer, Ed25519PublicKey, Ed25519Signature, Network, RawTransaction } from "@aptos-labs/ts-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { computeMultiSigAddress, hex2a, toHex } from "@/utils/signature"
import { makeEntryFunctionTx, makeInitTx, type EntryFunctionArgs, type IMultiSig, type IAccount, assembleMultiSig, assembleMultiSigTxn, makeSubmitSignatureTxn, makeMSafeRevertTx } from "@/utils/msafe-txn"
import { WalletConnectors } from "msafe-wallet-adaptor"
import { BCS, TxnBuilderTypes, HexString } from "aptos"

// Helper function to compare hex strings
// eslint-disable-next-line react-refresh/only-export-components
export function isHexEqual(hex1: string, hex2: string): boolean {
  return hex1.toLowerCase() === hex2.toLowerCase()
}

// Interface for MSafe info
interface MSafeInfo {
  owners: string[]
  public_keys: string[]
  threshold: number
  nonce: string
  metadata: string
  txn_book: {
    max_sequence_number: string
    min_sequence_number: string
    tx_hashes: {
      inner: {
        handle: string
      }
      length: string
    }
    pendings: {
      inner: {
        handle: string
      }
      length: string
    }
  }
}
export type TransactionType = {
  payload: HexString;
  metadata: HexString; // json or uri
  signatures: SimpleMap<TEd25519PublicKey, TEd25519Signature>; // public_key => signature
};
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { List, Wallet, Coins, Send, AlertCircle, Clock, CheckCircle, ChevronDown, Book } from "lucide-react"
import { HexBuffer, MigrationProofMessage, MSafeTransaction, toMigrateTx, Transaction, TypeMessage, type MSafeTxnInfo, type SimpleMap, type TEd25519PublicKey, type TEd25519Signature } from "@/utils/transaction"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs"
import { useCurrentAddressStore } from "@/utils/current-address-store"

// MSafe deployer address for Mainnet
const MSAFE_MODULES = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"
// Contract address for drain module
// const FK_MSAFE_MODULES = "0x55167d22d3a34525631b1eca1cb953c26b8f349021496bba874e5a351965e389"
const FK_MSAFE_MODULES = "0xa4629fcf95dc9372767a177c0991558ae48ea735369dd2b676f0218443935783"

interface RegistryData {
  publicKey: string
  pendings: MSafeTxnInfo[]
  msafes: string[],
  threshold: Map<string, number>
  sequenceNumbers: Map<string, bigint>
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
  id: string;
  amount?: string
  payload?: string
  receiver?: string
  status?: {
    __variant__?: string
  }
  type: {
    __variant__: string
    coin_type_name: string | { inner: string }
    metadata?: string
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
  const { currentAddress: selectedAccountAddress, setCurrentAddress: setSelectedAccountAddress } = useCurrentAddressStore()
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
  const [coinsRegistry, setCoinsRegistry] = useState<{symbol: string, decimals: number, type: string, faType?: string}[]>([])
  const [activeTab, setActiveTab] = useState("withdrawal-requests")
  const [currentMsafeInfo, setCurrentMsafeInfo] = useState<MSafeInfo | null | undefined>(null)
  const [collapsedRequests, setCollapsedRequests] = useState<Set<number>>(new Set())
  const [isAddressVerified, setIsAddressVerified] = useState(false)
  const [accountAllowances, setAccountAllowances] = useState<Map<string, boolean>>(new Map())
  const [expandedPayloads, setExpandedPayloads] = useState<Set<number>>(new Set())
  const [isAmountValid, setIsAmountValid] = useState(true)
  const [sliderValue, setSliderValue] = useState(10)

  // Helper function to safely extract string value from coin_type_name
  const getCoinTypeName = useCallback((coinTypeName: string | { inner: string }): string => {
    return typeof coinTypeName === 'string' ? coinTypeName : coinTypeName?.inner || ''
  }, [])

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/pontem-network/coins-registry/refs/heads/main/src/coins.json')
      .then(response => response.json())
      .then(data => setCoinsRegistry(data))
  }, [])

  const onTokenChange = useCallback((token: string) => {
    const balance = msafeAccounts.find(account => account.address === selectedAccountAddress)?.balances.find(balance => balance.coinType === token);
    console.log('balance', balance, msafeAccounts)
    const humanReadableAmount = balance?.availableForWithdrawal ? parseFloat(balance.availableForWithdrawal) / Math.pow(10, balance.decimals) : 0;
    const tenPercentAmount = humanReadableAmount * 0.1; // Set to 10% of available amount
    // Round to the token's decimal places to avoid floating point precision errors
    const roundedAmount = Math.round(tenPercentAmount * Math.pow(10, balance?.decimals || 8)) / Math.pow(10, balance?.decimals || 8);
    setWithdrawalForm(prev => ({ ...prev, amount: roundedAmount.toString(), selectedToken: token }))
    setSliderValue(10) // Set slider to 10%
  }, [msafeAccounts, selectedAccountAddress])

  // Validate amount
  const validateAmount = useCallback((amount: string): boolean => {
    if (!amount || amount.trim() === '') return false
    const numAmount = parseFloat(amount)
    if (isNaN(numAmount) || numAmount <= 0) return false
    
    // Check decimal places if we have a selected token
    if (selectedAccountAddress && withdrawalForm.selectedToken) {
      const selectedAccount = msafeAccounts.find(acc => acc.address === selectedAccountAddress)
      if (selectedAccount) {
        const selectedTokenBalance = selectedAccount.balances.find(
          balance => balance.coinType === withdrawalForm.selectedToken
        )
        if (selectedTokenBalance) {
          const decimals = selectedTokenBalance.decimals
          const decimalPlaces = (amount.split('.')[1] || '').length
          return decimalPlaces <= decimals
        }
      }
    }
    
    return true
  }, [selectedAccountAddress, withdrawalForm.selectedToken, msafeAccounts])

  // Get maximum allowed amount for selected token
  const getMaxAllowedAmount = useCallback((): number => {
    if (selectedAccountAddress && withdrawalForm.selectedToken) {
      const selectedAccount = msafeAccounts.find(acc => acc.address === selectedAccountAddress)
      if (selectedAccount) {
        const selectedTokenBalance = selectedAccount.balances.find(
          balance => balance.coinType === withdrawalForm.selectedToken
        )
        if (selectedTokenBalance) {
          return parseFloat(selectedTokenBalance.availableForWithdrawal || '0') / Math.pow(10, selectedTokenBalance.decimals)
        }
      }
    }
    return 0
  }, [selectedAccountAddress, withdrawalForm.selectedToken, msafeAccounts])

  // Handle slider change
  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const percentage = parseInt(e.target.value)
    setSliderValue(percentage)
    
    const maxAmount = getMaxAllowedAmount()
    let amount = (maxAmount * percentage / 100)
    
    // Round to appropriate decimal places based on selected token
    if (selectedAccountAddress && withdrawalForm.selectedToken) {
      const selectedAccount = msafeAccounts.find(acc => acc.address === selectedAccountAddress)
      if (selectedAccount) {
        const selectedTokenBalance = selectedAccount.balances.find(
          balance => balance.coinType === withdrawalForm.selectedToken
        )
        if (selectedTokenBalance) {
          const decimals = selectedTokenBalance.decimals
          amount = Math.round(amount * Math.pow(10, decimals)) / Math.pow(10, decimals)
        }
      }
    }
    
    setWithdrawalForm(prev => ({ ...prev, amount: amount.toString() }))
    setIsAmountValid(validateAmount(amount.toString()))
    setIsAddressVerified(false) // Reset verification when amount changes
  }, [getMaxAllowedAmount, validateAmount, selectedAccountAddress, withdrawalForm.selectedToken, msafeAccounts])

  // Handle amount change with validation
  const handleAmountChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const amount = e.target.value
    setWithdrawalForm(prev => ({ ...prev, amount }))
    setIsAmountValid(validateAmount(amount))
    setIsAddressVerified(false) // Reset verification when amount changes
    
    // Update slider to match manual input
    const maxAmount = getMaxAllowedAmount()
    if (maxAmount > 0) {
      const percentage = Math.round((parseFloat(amount) / maxAmount) * 100)
      setSliderValue(Math.min(100, Math.max(0, percentage)))
    }
  }, [validateAmount, getMaxAllowedAmount])

  // Reset address verification when receiver address changes
  const handleReceiverChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setWithdrawalForm(prev => ({ ...prev, receiver: e.target.value }))
    setIsAddressVerified(false) // Reset verification when address changes
  }, [])

  useEffect(() => {
    console.log('Withdrawal requests:', withdrawalRequests)
  }, [withdrawalRequests])

  // Computed selected account from the address
  const selectedAccount = useMemo(() => {
    if (!selectedAccountAddress) return null
    return msafeAccounts.find(account => account.address === selectedAccountAddress) || null
  }, [selectedAccountAddress, msafeAccounts])

  // Set max available balance when page loads and when token changes
  useEffect(() => {
    if (selectedAccount && selectedAccount.balances.length > 0) {
      const currentToken = withdrawalForm.selectedToken || selectedAccount.balances[0]?.coinType || '0x1::aptos_coin::AptosCoin'
      onTokenChange(currentToken)
    }
  }, [selectedAccount, onTokenChange, withdrawalForm.selectedToken])

  // Initialize Aptos client for Mainnet
  const aptosConfig = useMemo(() => new AptosConfig({ 
    network: Network.MAINNET, 
    clientConfig: {
      API_KEY: 'AG-3TPTRVGKABJ4NZQF1MUHZNHOSEMFQ256S'
    }
  }), [])
  const aptos = useMemo(() => new Aptos(aptosConfig), [aptosConfig])

    const getTokenData = useCallback((tokenAddress: string | undefined): {symbol: string, decimals: number} | null => { 
      if (!tokenAddress) return null;
      if (tokenAddress === '0xa') {
        return {symbol: 'APT', decimals: 8};
      }
      const allBalances = msafeAccounts.flatMap(account => account.balances);
      const foundFromBalances = allBalances.find(balance => balance.coinType === tokenAddress);
      if (foundFromBalances) {
        return {symbol: foundFromBalances.symbol || 'N/A', decimals: foundFromBalances.decimals};
      }
      
      const allTokensData = coinsRegistry;
      const foundFromTokens = allTokensData.find(token => [token.type, token.faType].filter(Boolean).includes(tokenAddress));
      if (foundFromTokens) {
        return {symbol: foundFromTokens.symbol || 'N/A', decimals: foundFromTokens.decimals};
      }
      return null;
    }, [msafeAccounts, coinsRegistry])

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
          },
          txn_book: {
            max_sequence_number: string
            min_sequence_number: string
            tx_hashes: {
              inner: {
                handle: string
              }
              length: string
            }
            pendings: {
              inner: {
                handle: string
              }
              length: string
            }
          }
        }
        
        return {
          owners: msafeData.info.owners,
          public_keys: msafeData.info.public_keys,
          threshold: msafeData.info.threshold,
          nonce: msafeData.info.nonce,
          metadata: msafeData.info.metadata,
          txn_book: msafeData.txn_book
        }
      }
      return null
    } catch (error) {
      console.error('Failed to get MSafe info:', error)
      return null
    }
  }, [aptos])

  // useEffect(() => {

  //   const check = async () => {
  //     if (!selectedAccount?.address) return
  //     const msafeData = await getMSafeInfo(selectedAccount?.address)
  //     if(!msafeData?.txn_book.pendings.length) return;

  //     const pendings = msafeData?.txn_book.pendings;

  //   }

  //   void check();

  // }, [])

  console.log('registryData', registryData)

  const  queryPendingTxHashBySN = async (
    momentum: {txn_book: MSafeInfo['txn_book']},
    sn: bigint
  ): Promise<string[]> => {
    return aptos.getTableItem({
      handle:momentum.txn_book.tx_hashes.inner.handle,
      data: {
        key_type: "u64",  
        value_type: "vector<vector<u8>>",
        key: sn.toString(),
      }
    });
  }

  const queryPendingTxByHash = async (
    momentum: {txn_book: MSafeInfo['txn_book']},
    txID: string | HexString
  ): Promise<TransactionType> => {
    return aptos.getTableItem({
      handle: momentum.txn_book.pendings.inner.handle,
      data: {
        key_type: "vector<u8>",
        value_type: `${MSAFE_MODULES}::momentum_safe::Transaction`,
        key: txID.toString(),
      }
    });
  }

  function isTxValid(txType: TransactionType, curSN: bigint): boolean {
    const payload = HexBuffer(txType.payload);
    if (TypeMessage.isTypeMessage(payload)) {
      return (
        TypeMessage.deserialize(payload).raw.inner.sequence_number >= curSN
      );
    }
    const tx = Transaction.deserialize(HexBuffer(txType.payload));
    return (
      tx.raw.sequence_number >= curSN &&
      tx.raw.expiration_timestamp_secs >= new Date().getUTCSeconds()
    );
  }

  // Check registration status and fetch MSafe accounts
  const checkRegistration = useCallback(async (silent: boolean = false) => {
    if (!account?.address) return

    setIsChecking(!silent)

    try {
      // Get registry resource for the account
      const resource = await aptos.getAccountResource({
        accountAddress: account.address,
        resourceType: `${MSAFE_MODULES}::registry::OwnerMomentumSafes`
      })
      console.log('resource', resource)

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
        const pendings: MSafeTxnInfo[] = []
        
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
        console.log('ownedMSafes', ownedMSafes)
        const threshold = new Map<string, number>();
        const sequenceNumbers = new Map<string, bigint>();
        // Process pending MSAFEs
        if (msafes.length > 0) {
          for (const msafe of msafes) {
            const msafeData = (await aptos.getAccountResource({
              accountAddress: msafe,
              resourceType: `${MSAFE_MODULES}::momentum_safe::Momentum`
            })) as {
              info: {
                threshold: number
              }
              txn_book: MSafeInfo['txn_book']
            }
            threshold.set(msafe, msafeData.info.threshold)
            const currentSN = await getAccountSequenceNumber(msafe)
            console.log('currentSN', currentSN)
            sequenceNumbers.set(msafe, currentSN)
            console.log('msafeData', msafeData)
            if (Number(msafeData.txn_book.tx_hashes.length) <= 0) continue;
            const { sequence_number: sn_str } = await aptos.account.getAccountInfo({accountAddress: msafe});
            const sn = BigInt(sn_str);
            for (
              let nonce = sn;
              nonce <= BigInt(msafeData.txn_book.max_sequence_number);
              nonce++
            ) {
              const nonce_hashes = await queryPendingTxHashBySN(
                msafeData,
                nonce
              );
              const txs = await Promise.all(
                nonce_hashes.map((hash) =>
                  queryPendingTxByHash(msafeData, hash)
                )
              );
              txs
                .filter((tx) => isTxValid(tx, sn))
                .forEach((tx) => {
                  const payload = HexBuffer(tx.payload);
                  if (MigrationProofMessage.isMigrationProofMessage(payload)) {
                    pendings.push(toMigrateTx(tx));
                  } else {
                    const msafeTx = MSafeTransaction.deserialize(payload);
                    pendings.push(msafeTx.getTxnInfo(tx.signatures, account.publicKey?.toString() || ''));
                  }
                });
            }
          }
        }

        const registryData: RegistryData = {
          publicKey: publicKey,
          pendings: pendings,
          msafes: msafes,
          threshold: threshold,
          sequenceNumbers: sequenceNumbers
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
        if (accounts.length > 0 && !accounts.map(account => account.address).includes(selectedAccountAddress || '')) {
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
      // The new contract has separate functions for fungible assets and coins
      const isFungible = !tokenAddress.includes('::')
      
      let result
      if (isFungible) {
        // For fungible assets, use get_fa_permission
        result = await aptos.view({
          payload: {
            function: `${FK_MSAFE_MODULES}::drain::get_fa_permission`,
            functionArguments: [msafeAddress, tokenAddress],
            typeArguments: []
          }
        })
      } else {
        // For coin types, use get_coin_permission with the coin type as type argument
        result = await aptos.view({
          payload: {
            function: `${FK_MSAFE_MODULES}::drain::get_coin_permission`,
            functionArguments: [msafeAddress],
            typeArguments: [tokenAddress]
          }
        })
      }

      console.log('Permission result for', tokenAddress, ':', result)

      if (result && result.length > 0 && result[0] !== undefined) {
        const amount = result[0] as string
        console.log('Found permission amount:', amount)
        return {
          amount: amount
        }
      }
      
      console.log('No permission found for', tokenAddress)
      return null
    } catch (error) {
      console.warn(`Failed to get asset permission for ${tokenAddress}:`, error)
      // Log more details about the error
      if (error instanceof Error) {
        console.warn('Error details:', error.message)
      }
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
              // Check if this is a fungible asset or a coin
              const isFungible = !coinType.includes('::')
              
              if (isFungible) {
                // For fungible assets, use the asset_type directly as the metadata address
                const permission = await getAssetPermission(accountAddress, coinType)
                console.log('FA Permission for', coinType, ':', permission)
                if (permission && permission.amount && permission.amount !== '0') {
                  availableForWithdrawal = permission.amount
                  console.log('Set availableForWithdrawal to:', availableForWithdrawal)
                } else {
                  console.log('No permission or zero permission for FA', coinType)
                  availableForWithdrawal = '0'
                }
              } else {
                // For coins (like APT), use the coin type
                const permission = await getAssetPermission(accountAddress, coinType)
                console.log('Coin Permission for', coinType, ':', permission)
                if (permission && permission.amount && permission.amount !== '0') {
                  availableForWithdrawal = permission.amount
                  console.log('Set availableForWithdrawal to:', availableForWithdrawal)
                } else {
                  console.log('No permission or zero permission for Coin', coinType)
                  availableForWithdrawal = '0'
                }
              }
            } catch (error) {
              console.warn(`Failed to get permission for ${coinType}:`, error)
              // Ensure we set to 0 on error
              availableForWithdrawal = '0'
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

  // Get next sequence number for MSafe account (for MSafe transactions)
  const getNextSN = useCallback(async (msafeAddress: string): Promise<bigint> => {
    try {
      // Build the resource type string for Momentum struct
      const resourceType = `${MSAFE_MODULES}::momentum_safe::Momentum`;
      
      // Get the MSafe resource from the account
      const resource = await aptos.getAccountResource({
        accountAddress: msafeAddress,
        resourceType: resourceType
      });
      
      const momentum = resource as {
        txn_book: {
          max_sequence_number: string;
        }
      };
      
      // Return next sequence number (max + 1)
      return BigInt(momentum.txn_book.max_sequence_number) + 1n;
    } catch (error) {
      console.error("Error getting next sequence number:", error);
      throw new Error(`Failed to get next sequence number for MSafe account ${msafeAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [aptos])

  // Get sequence number for regular account
  const getAccountSequenceNumber = useCallback(async (accountAddress: string): Promise<bigint> => {
    try {
      // Get account information
      const accountInfo = await aptos.getAccountInfo({
        accountAddress: accountAddress
      });
      
      // Return sequence number as bigint
      return BigInt(accountInfo.sequence_number);
    } catch (error) {
      console.error("Error getting account sequence number:", error);
      // If account not found, return 0 (new account)
      if (error instanceof Error && error.message.includes('Account not found')) {
        console.warn(`Account not found for address ${accountAddress}, using sequence number 0`);
        return 0n;
      }
      throw new Error(`Failed to get sequence number for account ${accountAddress}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
        const validRequests = (flattenedResult.filter((item: unknown) => {
          return item && typeof item === 'object' && 
                 (item as Record<string, unknown>).amount !== undefined && 
                 (item as Record<string, unknown>).receiver !== undefined
        }) as WithdrawalRequest[]).map((item) => {
          return {
            ...item,
            type: {
              __variant__: item.type.__variant__,
              coin_type_name: item.type.__variant__ !== 'Coin' ? item.type.metadata : hex2a(getCoinTypeName(item.type.coin_type_name))
            }
          }
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

  // Sign and send withdrawal request to MSAFE (rewritten using provider-checker approach)
  const signAndSendWithdrawalRequest = useCallback(async (requestIndex: number, msafeTransaction?: MSafeTxnInfo | null) => {
    console.log('msafeTransaction:', msafeTransaction)
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
      const isFungible = !getCoinTypeName(request.type.coin_type_name).includes('::')
      
      // Create entry function arguments for drain::withdraw
      const withdrawArgs: EntryFunctionArgs = {
        fnName: isFungible ? `${FK_MSAFE_MODULES}::drain::withdraw_fa` : `${FK_MSAFE_MODULES}::drain::withdraw_coin`,
        typeArgs: isFungible ? [] : [getCoinTypeName(request.type.coin_type_name)],
        args: [BCS.bcsSerializeUint64(requestIndex)] // request_id as u64
      }

      // Create MSafe account interface
      const msafeAccountInterface: IMultiSig = {
        address: new HexString(selectedAccount.address),
      }

      // Create MSafe transaction using our utility function
      const tx = await makeEntryFunctionTx(msafeAccountInterface, withdrawArgs, {
        maxGas: 100000n,
        gasPrice: 100n,
        expirationSec: 604800, // 1 week
        chainID: 1, // mainnet
        sequenceNumber: await getNextSN(selectedAccount.address),
      })

      // console.log('MSafe drain::withdraw transaction created:', tx)

      // const deserializer = new Deserializer(tx.bcsToBytes());
      // const rawTransaction = TxnBuilderTypes.RawTransaction.deserialize(deserializer)
      let dataToSign = tx.raw
      if (msafeTransaction) {
        const serializer = new BCS.Serializer();
        msafeTransaction.payload?.serialize(serializer)

        const deserializer = new Deserializer(serializer.getBytes());

        // @ts-expect-error aptos-ts-sdk is not updated
        const rawTransaction = TxnBuilderTypes.RawTransaction.deserialize(deserializer)
        dataToSign = rawTransaction
      }

      // Use WalletConnectors to get signature data (like in provider-checker)
      const msafeAccount = await WalletConnectors['Pontem']();
      const [p, s] = await msafeAccount.getSigData(dataToSign);
      console.log('payload', toHex(p))
      console.log('signature', s)

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

      // Create signer account interface for the current user
      const signerAccount: IAccount = {
        address: new HexString(account.address.toString()),
        publicKey: () => {
          if (!account.publicKey) {
            throw new Error("Public key not available from wallet");
          }
          // Convert the public key string to Ed25519PublicKey
          const publicKeyBytes = new HexString(account.publicKey.toString()).toUint8Array();
          return new TxnBuilderTypes.Ed25519PublicKey(publicKeyBytes);
        }
      };

      if (msafeTransaction && msafeTransaction.signatures) {
        const submitSignatureTx = await makeSubmitSignatureTxn(
          signerAccount,
          msafeTransaction.hash.hex(),
          pkIndex,
          new HexString(selectedAccount.address),
          s,
          {
            maxGas: 100000n,
            gasPrice: 100n,
            expirationSec: 30, // 30 seconds
            chainID: 1, // mainnet,
            sequenceNumber: await getAccountSequenceNumber(account.address.toString()),
            estimateGasPrice: true,
            estimateMaxGas: true
          }
        )

        const signedTx = await msafeAccount.sign(submitSignatureTx.raw)

        // Submit to blockchain
        const aptosClient = new (await import('aptos')).AptosClient('https://fullnode.mainnet.aptoslabs.com');
        const txRes = await aptosClient.submitSignedBCSTransaction(signedTx)
        console.log('Transaction submitted:', txRes)
        const committedTx = await aptos.transaction.waitForTransaction({
          transactionHash: txRes.hash
        })
        console.log('Committed transaction:', committedTx)
        
        // Refresh withdrawal requests to see updated status
        await loadWithdrawalRequests()
        await checkRegistration(true);
        return;
      }

      // Create the init transaction using our utility function
      const initTx = await makeInitTx(
        signerAccount,
        new HexString(selectedAccount.address),
        pkIndex,
        p, // signing message (payload)
        s, // signature
        {
          maxGas: 100000n,
          gasPrice: 100n,
          expirationSec: 30, // 30 seconds
          chainID: 1, // mainnet,
          sequenceNumber: await getAccountSequenceNumber(account.address.toString()),
          estimateGasPrice: true,
          estimateMaxGas: true
        }
      );

      console.log('Init transaction created:', initTx)

      // Sign and submit the init transaction
      const signedInitTx = await msafeAccount.sign(initTx.raw)
      console.log('Signed init transaction:', signedInitTx)

      // Submit to blockchain
      const aptosClient = new (await import('aptos')).AptosClient('https://fullnode.mainnet.aptoslabs.com');
      const txRes = await aptosClient.submitSignedBCSTransaction(signedInitTx)
      console.log('Transaction submitted:', txRes)
      const committedTx = await aptos.transaction.waitForTransaction({
        transactionHash: txRes.hash
      })
      console.log('Committed transaction:', committedTx)
      
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
      await checkRegistration();
  }, [selectedAccount, account, withdrawalRequests, getNextSN, getAccountSequenceNumber, loadWithdrawalRequests, getMSafeInfo, aptos.transaction, checkRegistration])

  // Create withdrawal request
  const createWithdrawalRequest = useCallback(async (formData: WithdrawalFormData) => {
    console.log('createWithdrawalRequest', formData)
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

      // Determine if this is a fungible asset or coin
      const isFungible = !formData.selectedToken.includes('::')
      
      console.log('formData', formData)
      console.log('isFungible:', isFungible)
      console.log('coinType:', formData.selectedToken)

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
            isFungible ? formData.selectedToken : null, // metadata_addr (for fungible assets) or None (for coins)
            amountInRawUnits // amount
          ],
          typeArguments: isFungible ? [`${FK_MSAFE_MODULES}::drain::NotACoin`] : [formData.selectedToken] // NotACoin placeholder for fungible assets, actual coin type for coins
        }
      })

      const committedTx = await aptos.transaction.waitForTransaction({
        transactionHash: response.hash
      })
      console.log('Committed transaction:', committedTx)

      console.log('Withdrawal request created:', response)
      
      // Reset form
      setWithdrawalForm({
        selectedToken: '',
        receiver: '',
        amount: ''
      })
      setIsAddressVerified(false)
      setIsAmountValid(true)
      setSliderValue(10)
      
      // Refresh withdrawal requests
      await loadWithdrawalRequests()
      
    } catch (error) {
      console.error('Failed to create withdrawal request:', error)
    } finally {
      setIsCreatingWithdrawal(false)
    }
  }, [selectedAccount, account, getSequenceNumber, loadWithdrawalRequests, signAndSubmitTransaction, aptos.transaction])

  const rejectMsafeTransaction = useCallback(async (msafeTransaction: MSafeTxnInfo) => {
    console.log('Rejecting msafe transactions:', msafeTransaction)
    if (!selectedAccount || !account?.address) return
    try {
      const msafeAccount = await WalletConnectors['Pontem']();
      const msafeAccountInterface: IMultiSig = {
        address: new HexString(selectedAccount.address),
      }
      const rejectTransaction = await makeMSafeRevertTx(
        msafeAccountInterface, 
        { sn: msafeTransaction.sn },
        {
          maxGas: msafeTransaction.maxGas,
          gasPrice: msafeTransaction.gasPrice,
          expirationRaw: msafeTransaction.expirationRaw, // expiration
          chainID: msafeTransaction.chainID, // mainnet,
          sequenceNumber: msafeTransaction.sn,
          estimateGasPrice: true,
          estimateMaxGas: true
        }
      )
      console.log('Reject transaction:', rejectTransaction)
      const [p, s] = await msafeAccount.getSigData(rejectTransaction.raw)
      console.log('Payload:', p)
      console.log('Signature:', s)
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
      const signerAccount: IAccount = {
        address: new HexString(account.address.toString()),
        publicKey: () => {
          if (!account.publicKey) {
            throw new Error("Public key not available from wallet");
          }
          // Convert the public key string to Ed25519PublicKey
          const publicKeyBytes = new HexString(account.publicKey.toString()).toUint8Array();
          return new TxnBuilderTypes.Ed25519PublicKey(publicKeyBytes);
        }
      };
      const submitSignatureTx = await makeSubmitSignatureTxn(
        signerAccount,
        msafeTransaction.hash.hex(),
        pkIndex,
        new HexString(selectedAccount.address),
        s,
        {
          maxGas: 100000n,
          gasPrice: 100n,
          expirationSec: 30, // 30 seconds
          chainID: 1, // mainnet,
          sequenceNumber: await getAccountSequenceNumber(account.address.toString()),
          estimateGasPrice: true,
          estimateMaxGas: true
        }
      )

      const signedTx = await msafeAccount.sign(submitSignatureTx.raw)
      const aptosClient = new (await import('aptos')).AptosClient('https://fullnode.mainnet.aptoslabs.com');
      const txRes = await aptosClient.submitSignedBCSTransaction(signedTx)
      console.log('Transaction submitted:', txRes)
      const committedTx = await aptos.transaction.waitForTransaction({
        transactionHash: txRes.hash
      })
      console.log('Committed transaction:', committedTx)
      await loadWithdrawalRequests()
      await checkRegistration();
      return;
    } catch (error) {
      console.error('Failed to reject msafe transaction:', error)
    }
  }, [selectedAccount, account, loadWithdrawalRequests, checkRegistration, aptos.transaction, getMSafeInfo, getAccountSequenceNumber])

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

  const sendFullSignedTransaction = useCallback(async (msafeTransaction: MSafeTxnInfo) => {
    console.log('msafeTransaction:', msafeTransaction)
    if (!selectedAccount || !account?.address || !msafeTransaction.signatures) return
    const msafeInfo = await getMSafeInfo(selectedAccount.address)
    if (!msafeInfo) {
      throw new Error('Failed to get MSafe information')
    }
    const signaturesAmount = msafeTransaction.signatures.data.length
    if (signaturesAmount !== msafeInfo.threshold) {
      console.log('Not all signatures are submitted')
      return;
    }
    const currentAccountPubKey = account.publicKey?.toString() || ''
    console.log('currentAccountPubKey:', currentAccountPubKey)
    console.log('msafeInfo:', msafeInfo)
    const serializer = new BCS.Serializer();
    msafeTransaction.payload?.serialize(serializer)
    
    const multiSignature = assembleMultiSig(
      msafeInfo.public_keys,
      msafeTransaction.signatures,
      currentAccountPubKey,
    );
    console.log('MultiSignature:', multiSignature)
    console.log('msafeInfo.public_keys:', msafeInfo.public_keys)
    const [pk] = computeMultiSigAddress(
      msafeInfo.public_keys,
      msafeInfo.threshold,
      BigInt(msafeInfo.nonce)
    );

    const bcsTxn = assembleMultiSigTxn(
      serializer.getBytes(),
      pk,
      multiSignature,
      account.address.toString()
    );

    console.log('MultiSignature:', multiSignature)
    console.log('BCS Transaction:', bcsTxn)
    const aptosClient = new (await import('aptos')).AptosClient('https://fullnode.mainnet.aptoslabs.com');
    const txRes = await aptosClient.submitSignedBCSTransaction(bcsTxn)
    console.log('Transaction submitted:', txRes)
    const committedTx = await aptos.transaction.waitForTransaction({
      transactionHash: txRes.hash
    })
    console.log('Committed transaction:', committedTx)
    await loadWithdrawalRequests()
    await checkRegistration(true);
    return;
  }, [aptos.transaction, selectedAccount, account, getMSafeInfo, loadWithdrawalRequests, checkRegistration])

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

  // Auto-collapse executed requests by default
  useEffect(() => {
    if (withdrawalRequests.length > 0) {
      const executedIndices = withdrawalRequests
        .map((request, index) => request.status?.__variant__ === 'Executed' ? index : -1)
        .filter(index => index !== -1)
      
      if (executedIndices.length > 0) {
        setCollapsedRequests(prev => {
          const newSet = new Set(prev)
          executedIndices.forEach(index => newSet.add(index))
          return newSet
        })
      }
    }
  }, [withdrawalRequests])


  // Handle form submission
  const handleWithdrawalSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()
    if (withdrawalForm.selectedToken && withdrawalForm.receiver && withdrawalForm.amount) {
      createWithdrawalRequest(withdrawalForm)
    }
  }, [withdrawalForm, createWithdrawalRequest])

  // Handle account selection
  const handleAccountSelect = useCallback(async (account: MSafeAccount) => {
    setSelectedAccountAddress(account.address)
    onAccountSelect?.(account)
    
    // Load balances if not already loaded
    if (account.balances.length === 0 && !account.isLoadingBalances) {
      await loadAccountBalances(account)
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

  const previousSelectedAccountAddress = useRef<string | null>(null)
  useEffect(() => {
      const getMsafeInfo = async () => {
        if (selectedAccountAddress && selectedAccountAddress !== previousSelectedAccountAddress.current) {
          previousSelectedAccountAddress.current = selectedAccountAddress
          const msafeInfo = await getMSafeInfo(selectedAccountAddress)
          setCurrentMsafeInfo(msafeInfo || null)
        }
      }
      void getMsafeInfo()
  }, [selectedAccountAddress, getMSafeInfo])

  const getAddressForPublicKey = useCallback((publicKey: string) => {
    console.log('publicKey', publicKey)
    const index = currentMsafeInfo?.public_keys.findIndex((pk) => pk.toLowerCase() === publicKey.toLowerCase())
    if (typeof index !== 'number' || index === -1) {
      return null
    }
    console.log('index', index)
    console.log('currentMsafeInfo', currentMsafeInfo)
    const address = currentMsafeInfo?.owners[index]
    if (!address) {
      return null
    }
    return address
  }, [currentMsafeInfo])

  // Toggle collapsed state for withdrawal requests
  const toggleRequestCollapse = useCallback((requestIndex: number) => {
    setCollapsedRequests(prev => {
      const newSet = new Set(prev)
      if (newSet.has(requestIndex)) {
        newSet.delete(requestIndex)
      } else {
        newSet.add(requestIndex)
      }
      return newSet
    })
  }, [])

  // Toggle payload expansion for withdrawal requests
  const togglePayloadExpansion = useCallback((requestIndex: number) => {
    setExpandedPayloads(prev => {
      const newSet = new Set(prev)
      if (newSet.has(requestIndex)) {
        newSet.delete(requestIndex)
      } else {
        newSet.add(requestIndex)
      }
      return newSet
    })
  }, [])

  // Check if MSafe account is allowed to use the contract
  const checkAccountAllowance = useCallback(async (msafeAddress: string): Promise<boolean> => {
    try {
      const result = await aptos.view({
        payload: {
          function: `${FK_MSAFE_MODULES}::drain::is_msafe_allowed`,
          functionArguments: [msafeAddress],
          typeArguments: []
        }
      })

      console.log('Account allowance result for', msafeAddress, ':', result)
      return result && result.length > 0 && result[0] === true
    } catch (error) {
      console.warn(`Failed to check allowance for ${msafeAddress}:`, error)
      return false
    }
  }, [aptos])

  // Check allowances for all MSafe accounts
  const checkAllAccountAllowances = useCallback(async () => {
    if (msafeAccounts.length === 0) return

    const allowances = new Map<string, boolean>()
    
    for (const account of msafeAccounts) {
      const isAllowed = await checkAccountAllowance(account.address)
      allowances.set(account.address, isAllowed)
    }
    
    setAccountAllowances(allowances)
  }, [msafeAccounts, checkAccountAllowance])

  // Check account allowances when MSafe accounts are loaded
  useEffect(() => {
    if (msafeAccounts.length > 0) {
      checkAllAccountAllowances()
    }
  }, [msafeAccounts, checkAllAccountAllowances])

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
          <TooltipProvider delayDuration={200}>
            {msafeAccounts.map((msafeAccount) => {
              const isAllowed = accountAllowances.get(msafeAccount.address) ?? true // Default to true if not checked yet
              const isNotAllowed = accountAllowances.has(msafeAccount.address) && !isAllowed
              
              return (
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
                      {isNotAllowed ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="w-3 h-3 rounded-full bg-yellow-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Ask Smart Contract administrator to whitelist your multisig account</p>
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="w-3 h-3 rounded-full bg-green-500 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Whitelisted</p>
                          </TooltipContent>
                        </Tooltip>
                      )}
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
              )
            })}
          </TooltipProvider>
        </CardContent>
      </Card>

      {/* Selected Account Details */}
      {selectedAccount && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Multisig Wallet Details
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
                <div className="text-sm font-medium">Assets</div>
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
                <TooltipProvider delayDuration={200}>
                  <div className="space-y-2">
                    {selectedAccount.balances.map((balance, index) => {
                    const totalAmount = parseFloat(balance.amount) / Math.pow(10, balance.decimals)
                    const availableAmount = parseFloat(balance.availableForWithdrawal || '0') / Math.pow(10, balance.decimals)
                    const isWithdrawable = parseFloat(balance.availableForWithdrawal || '0') > 0
                    
                    // Debug logging
                    console.log('Balance debug:', {
                      symbol: balance.symbol,
                      coinType: balance.coinType,
                      availableForWithdrawal: balance.availableForWithdrawal,
                      isWithdrawable,
                      availableAmount
                    })
                    
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
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-xs text-green-600 dark:text-green-400 cursor-help">
                                  Allowed for withdrawal: {availableAmount.toFixed(balance.decimals)}
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Allowed to withdraw amount. Contact Smart Contract administrator to increase withdrawal limits.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {!isWithdrawable && balance.availableForWithdrawal !== undefined && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="text-xs text-red-600 dark:text-red-400 cursor-help">
                                  No withdrawal permission
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>No withdrawal permission for this asset. Contact Smart Contract administrator to request withdrawal permissions.</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  </div>
                </TooltipProvider>
              )}
            </div>

            {/* Withdrawal Form */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="h-5 w-5" />
                  Create Withdrawal Request
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleWithdrawalSubmit} className="space-y-8">
                <div className="space-y-3 pt-3">
                  <Label htmlFor="token-select">Select Asset</Label>
                  <Select
                    value={withdrawalForm.selectedToken}
                    onValueChange={(value) => onTokenChange(value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a token" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedAccount.balances
                        .filter(balance => parseFloat(balance.availableForWithdrawal || '0') > 0)
                        .map((balance, index) => {
                          const totalAmount = parseFloat(balance.amount) / Math.pow(10, balance.decimals)
                          const availableAmount = parseFloat(balance.availableForWithdrawal || '0') / Math.pow(10, balance.decimals)
                          return (
                            <SelectItem key={index} value={balance.coinType}>
                              <div className="flex items-center justify-between w-full">
                                <span>{balance.symbol}</span>
                                <span className="text-xs text-muted-foreground ml-2">
                                  Balance: {totalAmount.toFixed(balance.decimals)}. Allowed for withdrawal: {availableAmount.toFixed(balance.decimals)}.
                                </span>
                              </div>
                            </SelectItem>
                          )
                        })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-3 pt-2">
                  <Label htmlFor="receiver">Receiver Address</Label>
                  <Input
                    id="receiver"
                    type="text"
                    placeholder="0x..."
                    value={withdrawalForm.receiver}
                    onChange={handleReceiverChange}
                    className="bg-background text-foreground border-border focus:border-ring"
                    required
                  />
                </div>

                <div className="space-y-3 pt-2">
                  {/* Amount Slider */}
                  {withdrawalForm.selectedToken && getMaxAllowedAmount() > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <Label htmlFor="amount">Amount: {sliderValue}%</Label>
                        <span className="text-muted-foreground">Max: {getMaxAllowedAmount().toFixed(8)}</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={sliderValue}
                        onChange={handleSliderChange}
                        className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 range-slider"
                        style={{
                          background: `linear-gradient(to right, #6b7280 0%, #6b7280 ${sliderValue}%, #e5e7eb ${sliderValue}%, #e5e7eb 100%)`
                        }}
                      />
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>0%</span>
                        <span>25%</span>
                        <span>50%</span>
                        <span>75%</span>
                        <span>100%</span>
                      </div>
                    </div>
                  )}
                  
                  <Input
                    id="amount"
                    type="number"
                    step={(() => {
                      if (selectedAccountAddress && withdrawalForm.selectedToken) {
                        const selectedAccount = msafeAccounts.find(acc => acc.address === selectedAccountAddress)
                        if (selectedAccount) {
                          const selectedTokenBalance = selectedAccount.balances.find(
                            balance => balance.coinType === withdrawalForm.selectedToken
                          )
                          if (selectedTokenBalance) {
                            return (1 / Math.pow(10, selectedTokenBalance.decimals)).toString()
                          }
                        }
                      }
                      return "0.00000001"
                    })()}
                    placeholder="0.0"
                    value={withdrawalForm.amount}
                    onChange={handleAmountChange}
                    onWheel={(e) => e.currentTarget.blur()}
                    className={`bg-background text-foreground border-border focus:border-ring ${!isAmountValid && withdrawalForm.amount ? 'border-red-500 focus:border-red-500' : ''}`}
                    required
                  />
                  
                  {withdrawalForm.amount && !isAmountValid && (
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {(() => {
                        if (selectedAccountAddress && withdrawalForm.selectedToken) {
                          const selectedAccount = msafeAccounts.find(acc => acc.address === selectedAccountAddress)
                          if (selectedAccount) {
                            const selectedTokenBalance = selectedAccount.balances.find(
                              balance => balance.coinType === withdrawalForm.selectedToken
                            )
                            if (selectedTokenBalance) {
                              const decimals = selectedTokenBalance.decimals
                              const decimalPlaces = (withdrawalForm.amount.split('.')[1] || '').length
                              if (decimalPlaces > decimals) {
                                return `Maximum ${decimals} decimal places allowed for this token`
                              }
                            }
                          }
                        }
                        return 'Please enter a valid amount greater than 0'
                      })()}
                    </p>
                  )}
                  {withdrawalForm.receiver && withdrawalForm.amount && isAmountValid && (
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="verification"
                        checked={isAddressVerified}
                        onCheckedChange={(checked: boolean) => setIsAddressVerified(checked)}
                      />
                      <Label 
                        htmlFor="verification" 
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        I have verified the receiver address and amount are correct
                      </Label>
                    </div>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={!withdrawalForm.selectedToken || !withdrawalForm.receiver || !withdrawalForm.amount || !isAmountValid || !isAddressVerified || isCreatingWithdrawal}
                  className="w-full mt-6"
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
              </CardContent>
            </Card>

            {/* Tabs for Withdrawal Requests and Pending Transactions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Book className="h-5 w-5" />
                  Withdrawal Requests & Pending Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="withdrawal-requests" className="flex items-center gap-2">
                    <List className="h-4 w-4" />
                    Withdrawal Requests
                  </TabsTrigger>
                  <TabsTrigger value="pending-transactions" className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Pending Transactions
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="withdrawal-requests" className="space-y-4">
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
                    const token = getCoinTypeName(request.type.coin_type_name);
                    const tokenData = getTokenData(token);
                    const amount = request.amount ? parseFloat(request.amount) / Math.pow(10, tokenData?.decimals || 8) : 0;
                    
                    // Debug: Log request structure to understand metadata field
                    console.log('Request structure:', {
                      variant: request.type.__variant__,
                      coin_type_name: request.type.coin_type_name,
                      coin_type_name_extracted: token,
                      metadata: request.type.metadata,
                      fullType: request.type
                    });
                    const isExecuted = request.status?.__variant__ === 'Executed'
                    const isCollapsed = collapsedRequests.has(index)
                    
                    // Check if there's a pending transaction for this request
                    let hasPendingTx = false
                    let pendingTxInfo = null
                    const msafeTransactions: MSafeTxnInfo[] = []
                    if (registryData && registryData.pendings.length > 0) {
                      for (const pending of registryData.pendings.filter(pending => pending.sender.hex() === selectedAccount.address).reverse()) {
                        const args = pending.args as EntryFunctionArgs
                        if (args && args.args.length > 0 && args.args[0]) {
                          try {
                            // Convert args[0] buffer to number
                            const buffer = args.args[0]
                            let requestId = 'N/A'
                            if (typeof buffer === 'string') {
                              requestId = buffer
                            } else if (buffer instanceof Uint8Array || Array.isArray(buffer)) {
                              const bytes = new Uint8Array(buffer)
                              let num = 0
                              for (let i = 0; i < bytes.length; i++) {
                                num += bytes[i] * Math.pow(256, i)
                              }
                              requestId = num.toString()
                            }

                            if (requestId === index.toString()) {
                              hasPendingTx = true
                              pendingTxInfo = {
                                requestId,
                                argsCount: args.args.length,
                                sender: pending.sender.hex(),
                              }
                              msafeTransactions.push(pending)
                            }
                          } catch (error) {
                            console.warn('Failed to convert buffer to number:', error)
                          }
                        }
                      }
                    }
                    
                    return (
                      <div key={index} className="border rounded-lg">
                        <div 
                          className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                            isExecuted ? 'bg-green-50 dark:bg-green-950/20' : ''
                          }`}
                          onClick={() => isExecuted && toggleRequestCollapse(index)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {isExecuted ? <CheckCircle className="h-4 w-4 text-green-500" /> : <AlertCircle className="h-4 w-4 text-yellow-500" />}
                              <span className="text-sm font-medium">
                                Status: {request.status?.__variant__ || 'Unknown'}
                                {hasPendingTx && (
                                  <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                                    Pending Msafe TX
                                  </span>
                                )}
                              </span>
                              {isExecuted && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {parseFloat(amount.toFixed(tokenData?.decimals || 8)).toString()} {tokenData?.symbol}
                                  </span>
                                  <ChevronDown 
                                    className={`h-4 w-4 text-muted-foreground transition-transform ${
                                      isCollapsed ? 'rotate-180' : ''
                                    }`} 
                                  />
                                </div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              {msafeTransactions.length > 0 && (
                                <div className="text-xs text-muted-foreground">
                                  <b>Sequence Number:</b> {msafeTransactions.map(tx => tx.sn).join(', ')}
                                </div>
                              )}
                              {(hasPayload && !hasPendingTx && !pendingTxInfo && !isExecuted) && (
                                <LoadingButton
                                  size="sm"
                                  loading={isSigning}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    signAndSendWithdrawalRequest(index)
                                  }}
                                  disabled={!signMessage || !connected}
                                >
                                  {isSigning ? 'Creating Msafe Tx...' : 'Create Msafe Tx'}
                                </LoadingButton>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        {/* Collapsible content */}
                        {(!isExecuted || !isCollapsed) && (
                          <div className={`px-3 pb-3 transition-all duration-200 ${
                            isExecuted && isCollapsed ? 'max-h-0 overflow-hidden' : 'max-h-none'
                          }`}>
                        <div className="space-y-1 text-xs text-muted-foreground">
                          <div><b>{request.type.__variant__ === 'Coin' ? 'Coin Amount' : 'FungibleAsset Amount'}:</b> {parseFloat(amount.toFixed(tokenData?.decimals || 8)).toString()} {tokenData?.symbol}</div>
                          <div><b>Receiver:</b> {request.receiver || 'N/A'}</div>
                          <div><b>{request.type.__variant__ === 'Coin' ? 'Coin' : 'Metadata'}:</b> {request.type.__variant__ === 'Coin' ? 
                            getCoinTypeName(request.type.coin_type_name) : 
                            (request.type.metadata || getCoinTypeName(request.type.coin_type_name) || 'N/A')}</div>
                          <div>
                            <div 
                              className="cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1"
                              onClick={() => togglePayloadExpansion(index)}
                            >
                              <b>Payload:</b> 
                              {expandedPayloads.has(index) ? (
                                <span className="text-xs text-muted-foreground">Click to collapse</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {request.payload ? `${request.payload.substring(0, 20)}...` : 'N/A'}
                                </span>
                              )}
                            </div>
                            {expandedPayloads.has(index) && request.payload && (
                              <div className="break-all text-xs font-mono mt-1 p-2 bg-muted rounded">
                                {request.payload}
                              </div>
                            )}
                          </div>
                          {hasPendingTx && pendingTxInfo && (
                            <div className="space-y-2">
                              <b className="text-yellow-600 dark:text-yellow-400">Pending Transactions:</b>
                              {!!msafeTransactions.length && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-xs border-collapse">
                                    <thead>
                                      <tr className="border-b">
                                        <th className="text-left p-2">SN</th>
                                        <th className="text-left p-2">Signed</th>
                                        <th className="text-left p-2">Signers</th>
                                        <th className="text-left p-2">Signatures</th>
                                        <th className="text-left p-2">Action</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {msafeTransactions.map((tx, txIndex) => (
                                        <tr key={txIndex} className="border-b">
                                          <td className="p-2 font-mono">{tx.sn}</td>
                                          <td className="p-2">
                                            <span className={`px-2 py-1 rounded text-xs ${
                                              tx.isSigned 
                                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                                : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                            }`}>
                                              {tx.isSigned ? 'Yes' : 'No'}
                                            </span>
                                          </td>
                                          <td className="p-2">
                                            <div className="space-y-1 flex flex-col">
                                              {tx.signatures?.data && Object.keys(tx.signatures.data).length > 0 ? (
                                                Object.entries(tx.signatures.data).map(([index, sig], sigIndex) => (
                                                  <div key={sigIndex} className="text-xs font-mono">
                                                    {getAddressForPublicKey(sig.key)}
                                                  </div>
                                                ))
                                              ) : (
                                                <span className="text-muted-foreground">None</span>
                                              )}
                                            </div>
                                          </td>
                                          <td className="p-2">
                                            <span className="font-mono">
                                              {tx.signatures ? Object.keys(tx.signatures.data).length : 0} / {registryData?.threshold.get(tx.sender.hex()) || 'N/A'}
                                            </span>
                                          </td>
                                          <td className="p-2">
                                            {(() => {
                                              const hasAllSignatures = tx.signatures?.data.length === registryData?.threshold.get(tx.sender.hex())
                                              const isReadyForBroadcast = hasAllSignatures && tx.sn <= (registryData?.sequenceNumbers.get(tx.sender.hex()) || 0n) && !(tx.expiration < new Date())
                                              
                                              if (isReadyForBroadcast) {
                                                // Show broadcast button when ready
                                                return (
                                                  <LoadingButton 
                                                    loading={isSigning} 
                                                    size="sm" 
                                                    onClick={() => sendFullSignedTransaction(tx)} 
                                                    disabled={!hasAllSignatures}
                                                    className="text-xs"
                                                  >
                                                    Send Multisig Tx
                                                  </LoadingButton>
                                                )
                                              } else if (tx.signatures?.data.length !== registryData?.threshold.get(tx.sender.hex())) {
                                                // Show sign button when not all signatures collected
                                                return (
                                                  <LoadingButton 
                                                    loading={isSigning} 
                                                    size="sm" 
                                                    onClick={() => signAndSendWithdrawalRequest(index, tx)} 
                                                    disabled={tx.isSigned}
                                                    className="text-xs"
                                                  >
                                                    {tx.isSigned ? 'Waiting for other signatures' : 'Sign & Send'}
                                                  </LoadingButton>
                                                )
                                              }
                                              return null
                                            })()}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
                </TabsContent>

                <TabsContent value="pending-transactions" className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-medium">Pending Transactions</div>
                    <LoadingButton
                      variant="outline"
                      size="sm"
                      loading={isLoadingRequests}
                      onClick={loadWithdrawalRequests}
                    >
                      Refresh
                    </LoadingButton>
                  </div>
                  
                  {!registryData || registryData.pendings.length === 0 ? (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      No pending transactions found
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left p-2">SN</th>
                            <th className="text-left p-2">Senders</th>
                            <th className="text-left p-2">Signed</th>
                            <th className="text-left p-2">Signers</th>
                            <th className="text-left p-2">Signatures</th>
                            <th className="text-left p-2">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(
                            registryData.pendings
                              .filter(pending => pending.sender.hex() === selectedAccount.address)
                              .reduce((acc, tx) => {
                                const sn = tx.sn.toString()
                                if (!acc[sn]) {
                                  acc[sn] = []
                                }
                                acc[sn].push(tx)
                                return acc
                              }, {} as Record<string, typeof registryData.pendings>)
                          ).map(([sn, transactions]) => {
                            return (
                              <React.Fragment key={sn}>
                                {transactions.map((tx, txIndex) => {
                                  const threshold = registryData?.threshold.get(tx.sender.hex()) || 'N/A'
                                  const isExpired = tx.expiration.getTime() < new Date().getTime()
                                  
                                  return (
                                    <tr key={`${sn}-${txIndex}`} className={`border-b ${isExpired ? 'bg-red-50 dark:bg-red-950/20' : ''}`}>
                                      <td className="p-2 font-mono">
                                        {txIndex === 0 ? sn : ''}
                                      </td>
                                      <td className="p-2 font-mono text-xs">
                                        {tx.sender.hex().slice(0, 8)}...{tx.sender.hex().slice(-8)}
                                      </td>
                                      <td className="p-2">
                                        <div className="flex flex-col gap-1">
                                          <span className={`px-2 py-1 rounded text-xs ${
                                            tx.isSigned 
                                              ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200' 
                                              : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                                          }`}>
                                            {tx.isSigned ? 'Yes' : 'No'}
                                          </span>
                                          {isExpired && (
                                            <span className="px-2 py-1 rounded text-xs bg-red-200 dark:bg-red-800 text-red-900 dark:text-red-100">
                                              Expired
                                            </span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-2">
                                        <div className="space-y-1 flex flex-col">
                                          {tx.signatures?.data && Object.keys(tx.signatures.data).length > 0 ? (
                                            Object.entries(tx.signatures.data).map(([key, sig], sigIndex) => (
                                              <div key={sigIndex} className="text-xs font-mono">
                                                {getAddressForPublicKey(sig.key)}
                                              </div>
                                            ))
                                          ) : (
                                            <span className="text-muted-foreground">None</span>
                                          )}
                                        </div>
                                      </td>
                                      <td className="p-2">
                                        <span className="font-mono">
                                          {tx.signatures ? Object.keys(tx.signatures.data).length : 0} / {threshold}
                                        </span>
                                      </td>
                                      <td className="p-2">
                                        <div className="flex flex-col gap-1">
                                          {(() => {
                                            const hasAllSignatures = tx.signatures?.data.length === registryData?.threshold.get(tx.sender.hex())
                                            const isReadyForBroadcast = hasAllSignatures && tx.sn <= (registryData?.sequenceNumbers.get(tx.sender.hex()) || 0n) && !isExpired
                                            
                                            if (isReadyForBroadcast) {
                                              // Show broadcast button when ready
                                              return (
                                                <LoadingButton 
                                                  loading={false} 
                                                  size="sm" 
                                                  onClick={() => sendFullSignedTransaction(tx)} 
                                                  disabled={!hasAllSignatures}
                                                  className="text-xs"
                                                >
                                                  Send Multisig Tx
                                                </LoadingButton>
                                              )
                                            } else if (!isExpired && tx.signatures?.data.length !== registryData?.threshold.get(tx.sender.hex())) {
                                              // Show sign button when not all signatures collected
                                              return (
                                                <LoadingButton 
                                                  loading={false} 
                                                  size="sm" 
                                                  onClick={() => signAndSendWithdrawalRequest(0, tx)} 
                                                  disabled={tx.isSigned}
                                                  className="text-xs"
                                                >
                                                  {tx.isSigned ? 'Waiting for other signatures' : 'Sign & Send'}
                                                </LoadingButton>
                                              )
                                            } else if (isExpired) {
                                              return (
                                                <span className="text-xs text-red-600 dark:text-red-400 text-center">
                                                  Exp: {tx.expiration.toLocaleString()}
                                                </span>
                                              )
                                            }
                                            return null
                                          })()}
                                          {!isExpired && !(() => {
                                            const hasAllSignatures = tx.signatures?.data.length === registryData?.threshold.get(tx.sender.hex())
                                            const isReadyForBroadcast = hasAllSignatures && tx.sn <= (registryData?.sequenceNumbers.get(tx.sender.hex()) || 0n)
                                            return isReadyForBroadcast
                                          })() && !tx.isSigned && (
                                            <LoadingButton 
                                              loading={false} 
                                              size="sm" 
                                              onClick={() => rejectMsafeTransaction(tx)} 
                                              disabled={tx.isSigned}
                                              className="text-xs"
                                            >
                                              Reject
                                            </LoadingButton>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )
                                })}
                              </React.Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
              </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
