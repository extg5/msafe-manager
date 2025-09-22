import { useState, useEffect, useCallback, useMemo } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig, Deserializer, Ed25519PublicKey, Ed25519Signature, Network, RawTransaction } from "@aptos-labs/ts-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { computeMultiSigAddress, toHex } from "@/utils/signature"
import { makeEntryFunctionTx, makeInitTx, type EntryFunctionArgs, type IMultiSig, type IAccount, assembleMultiSig, assembleMultiSigTxn, makeSubmitSignatureTxn } from "@/utils/msafe-txn"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { List, Wallet, Coins, Send, AlertCircle } from "lucide-react"
import { HexBuffer, MigrationProofMessage, MSafeTransaction, toMigrateTx, Transaction, TypeMessage, type MSafeTxnInfo, type SimpleMap, type TEd25519PublicKey, type TEd25519Signature } from "@/utils/transaction"

// MSafe deployer address for Mainnet
const MSAFE_MODULES = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"
// Contract address for drain module
const FK_MSAFE_MODULES = "0x55167d22d3a34525631b1eca1cb953c26b8f349021496bba874e5a351965e389"

interface RegistryData {
  publicKey: string
  pendings: MSafeTxnInfo[]
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
  const [coinsRegistry, setCoinsRegistry] = useState<{symbol: string, decimals: number, type: string, faType?: string}[]>([])

  useEffect(() => {
    fetch('https://raw.githubusercontent.com/pontem-network/coins-registry/refs/heads/main/src/coins.json')
      .then(response => response.json())
      .then(data => setCoinsRegistry(data))
  }, [])

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
    momentum: MSafeInfo,
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
    momentum: MSafeInfo,
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
        // Process pending MSAFEs
        if (msafes.length > 0) {
          for (const msafe of msafes) {
            const msafeData = (await aptos.getAccountResource({
              accountAddress: msafe,
              resourceType: `${MSAFE_MODULES}::momentum_safe::Momentum`
            })) as MSafeInfo
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
      
      // Create entry function arguments for drain::withdraw
      const withdrawArgs: EntryFunctionArgs = {
        fnName: `${FK_MSAFE_MODULES}::drain::withdraw`,
        typeArgs: [],
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
        // console.log('msafeTransaction:', msafeTransaction)
        // console.log('msafeInfo:', msafeInfo)
        // console.log('currentAccountPubKey:', currentAccountPubKey)
        // console.log('s:', s)
        // const multiSignature = assembleMultiSig(
        //   msafeInfo.public_keys,
        //   msafeTransaction.signatures,
        //   currentAccountPubKey,
        //   s
        // );
        // console.log('MultiSignature:', multiSignature)
        // console.log('p:', p)
        // console.log('msafeInfo.public_keys:', msafeInfo.public_keys)
        // const [pk] = computeMultiSigAddress(
        //   msafeInfo.public_keys,
        //   msafeInfo.threshold,
        //   BigInt(msafeInfo.nonce)
        // );

        // const bcsTxn = assembleMultiSigTxn(
        //   p,
        //   pk,
        //   multiSignature,
        //   account.address.toString()
        // );

        // console.log('MultiSignature:', multiSignature)
        // console.log('BCS Transaction:', bcsTxn)

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
  }, [selectedAccount, account, withdrawalRequests, getNextSN, getAccountSequenceNumber, loadWithdrawalRequests, getMSafeInfo, aptos.transaction])

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
      let metadataAddr = formData.selectedToken // Default for APT
      if (formData.selectedToken === '0x1::aptos_coin::AptosCoin') {
        metadataAddr = '0xa'
      } else if (formData.selectedToken.includes('::')) {
        metadataAddr = formData.selectedToken.split('::')[0]
      }

      console.log('formData', formData)
      console.log('metadataAddr:', metadataAddr)

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
      
      // Refresh withdrawal requests
      await loadWithdrawalRequests()
      
    } catch (error) {
      console.error('Failed to create withdrawal request:', error)
    } finally {
      setIsCreatingWithdrawal(false)
    }
  }, [selectedAccount, account, getSequenceNumber, loadWithdrawalRequests, signAndSubmitTransaction, aptos.transaction])

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
                              Allowed for withdrawal: {availableAmount.toFixed(balance.decimals)}
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
                    const token = request.fa_metadata?.inner;
                    const tokenData = getTokenData(token);
                    const amount = request.amount ? parseFloat(request.amount) / Math.pow(10, tokenData?.decimals || 8) : 0;
                    
                    // Check if there's a pending transaction for this request
                    let hasPendingTx = false
                    let pendingTxInfo = null
                    const msafeTransactions: MSafeTxnInfo[] = []
                    if (registryData && registryData.pendings.length > 0) {
                      for (const pending of registryData.pendings.reverse()) {
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
                                isSigned: pending.isSigned
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
                      <div key={index} className="p-3 border rounded-lg">
                        {index}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-yellow-500" />
                            <span className="text-sm font-medium">
                              Status: {request.status?.__variant__ || 'Unknown'}
                              {hasPendingTx && (
                                <span className="ml-2 px-2 py-1 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 text-xs rounded">
                                  Pending TX
                                </span>
                              )}
                            </span>
                          </div>
                          {msafeTransactions.length > 0 && (
                            <div className="text-xs text-muted-foreground">
                              <b>Sequence Number:</b> {msafeTransactions.map(tx => tx.sn).join(', ')}
                            </div>
                          )}
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
                          <div><b>Amount:</b> {amount.toFixed(tokenData?.decimals || 8)} {tokenData?.symbol}</div>
                          <div><b>Token:</b> {tokenData?.symbol || 'N/A'}</div>
                          <div><b>Receiver:</b> {request.receiver || 'N/A'}</div>
                          <div><b>Metadata:</b> {request.fa_metadata?.inner || 'N/A'}</div>
                          <div className="break-all"><b>Payload:</b> {request.payload || 'N/A'}</div>
                          {hasPendingTx && pendingTxInfo && (
                            <div className="flex flex-col items-center gap-2">
                              {pendingTxInfo.requestId}
                              {msafeTransactions.map(tx => tx.sn).join(', ')}
                              <b className="text-yellow-600 dark:text-yellow-400">Pending Transaction:</b> Request ID {pendingTxInfo.requestId} ({pendingTxInfo.argsCount} args)
                              {pendingTxInfo.isSigned && <p className="text-green-600 dark:text-green-400">Already signed</p>}
                              {!pendingTxInfo.isSigned && (
                                <div className="flex flex-col items-center gap-2">
                                  {msafeTransactions.map(tx => (
                                    <LoadingButton loading={isSigning} size="sm" onClick={() => signAndSendWithdrawalRequest(index, tx)}>Sign Existing TX & Send for SN {tx.sn}</LoadingButton>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
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
