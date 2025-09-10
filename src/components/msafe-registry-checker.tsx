import { useState, useEffect, useCallback, useMemo } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig, Network, Ed25519PublicKey, MultiEd25519PublicKey, AuthenticationKey, Hex } from "@aptos-labs/ts-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Shield, UserCheck, UserPlus, CheckCircle, XCircle, Plus, X } from "lucide-react"

// MSafe deployer address for Mainnet from the official documentation
// https://doc.m-safe.io/aptos/developers/system/msafe-contracts#deployed-smart-contract
const MSAFE_MODULES_ACCOUNT = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"

interface TransactionPayload {
  function: string
  type_arguments: string[]
  arguments: string[]
}

interface TransactionOptions {
  sender?: string
  sequence_number: number
  max_gas_amount: number
  gas_unit_price: number
  expiration_timestamp_secs: number
}

// Types for MSafe creation nonce handling
interface PendingMultiSigCreations {
  nonces: {
    handle: string
  }
  creations: {
    handle: string
  }
}

interface PontemProvider {
  connect: () => Promise<void>
  switchNetwork?: (chainId: number) => Promise<void>
  signTransaction: (payload: TransactionPayload, opts: TransactionOptions) => Promise<{ result?: Uint8Array } | Uint8Array>
  signAndSubmit: (payload: TransactionPayload, opts?: TransactionOptions) => Promise<{ result?: unknown, success?: boolean, payload?: unknown }>
}

interface RegistryData {
  publicKey: string
  pendings: string[]
  msafes: string[]
}

interface MSafeRegistryCheckerProps {
  onRegistrationStatusChange?: (isRegistered: boolean) => void
}

interface Result {
  type: 'success' | 'error'
  message: string
  data?: {
    msafeAddress?: string
    owners?: string[]
    threshold?: number
    initBalance?: number
    transactionHash?: string
  }
}

export function MSafeRegistryChecker({ onRegistrationStatusChange }: MSafeRegistryCheckerProps) {
  const { account, connected, signTransaction, signAndSubmitTransaction, wallet } = useWallet()
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [registryData, setRegistryData] = useState<RegistryData | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isCreatingMSafe, setIsCreatingMSafe] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  
  // MSafe creation form states
  const [owners, setOwners] = useState<string[]>([])
  const [threshold, setThreshold] = useState<number>(1)
  const [initBalance, setInitBalance] = useState<string>("0.1")

  // Initialize Aptos client для Mainnet
  const aptosConfig = useMemo(() => new AptosConfig({ network: Network.MAINNET }), [])
  const aptos = useMemo(() => new Aptos(aptosConfig), [aptosConfig])

  useEffect(() => {
    console.log('account', account)
    console.log('wallet', wallet)
  }, [account, wallet])

  // Check registration status
  const checkRegistration = useCallback(async () => {
    if (!account?.address) return

    setIsChecking(true)
    setResult(null)

    try {
      // Get registry resource for the account
      const resource = await aptos.getAccountResource({
        accountAddress: account.address,
        resourceType: `${MSAFE_MODULES_ACCOUNT}::registry::OwnerMomentumSafes`
      })

      // console.log('registry resource', resource)

      if (resource) {
        // Extract data from the resource
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
        
        // Get public key
        const publicKey = ownedMSafes.public_key
        
        // Extract MSAFE addresses from tables
        const msafes: string[] = []
        const pendings: string[] = []
        
        // Process active MSAFEs
        if (ownedMSafes.msafes && ownedMSafes.msafes.data) {
          const msafesLength = Number(ownedMSafes.msafes.data.length)
          console.log('Active MSAFEs length:', msafesLength)
          
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
          console.log('Pending MSAFEs length:', pendingsLength)
          
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
        
        console.log('Processed registry data:', registryData)
        console.log('Active MSAFEs found:', msafes.length)
        console.log('Pending MSAFEs found:', pendings.length)
        setRegistryData(registryData)
        setIsRegistered(true)
        onRegistrationStatusChange?.(true)
      }
    } catch (err) {
      const error = err as Error
      const status = (err as { status?: number }).status
      
      if (error.message?.includes("Resource not found") || status === 404) {
        setIsRegistered(false)
        setRegistryData(null)
        onRegistrationStatusChange?.(false)
      } else if (status === 429) {
        setResult({ type: 'error', message: "Too many requests to API. Please wait a moment and try again." })
        console.error("Rate limit exceeded:", error)
      } else {
        setResult({ type: 'error', message: `Failed to check registration: ${error.message}` })
        console.error("Registration check error:", error)
      }
    } finally {
      setIsChecking(false)
    }
  }, [account, aptos, onRegistrationStatusChange])

  // console.log('registryData', registryData)

  // MSafe deployer address for Mainnet
  const IMPORT_NONCE = BigInt('0xffffffffffffffff')


  // TODO: Make this configurable via UI
  // === TRANSACTION CONFIG ===
  const META = "Momentum Safe"
  const SEQ = 0
  const MAX_GAS = 12000
  const GAS_PX = 120
  const EXP = 1757277595
  const CHAINID = 1

  // === HELPERS ===
  const toHex = (u8: Uint8Array | number[]): string => {
    const bytes = u8 instanceof Uint8Array ? u8 : new Uint8Array(u8)
    return "0x" + Array.from(bytes).map(b => b.toString(16).padStart(2,"0")).join("")
  }

  // Extracts Ed25519 {variant=0x00, pubkey(32), signature(64)} from the end of BCS(SignedTransaction)
  const extractSigFromSignedTx = (signedBytes: Uint8Array | number[]) => {
    const bytes = signedBytes instanceof Uint8Array ? signedBytes : new Uint8Array(signedBytes)
    if (bytes.length < 1 + 1 + 32 + 1 + 64) throw new Error("SignedTransaction too short")

    // Tail layout (BCS):
    // ... [authenticator]
    //    variant(1B = 0x00 for ed25519)
    //    pubkey:  ULEB len (should be 0x20) + 32 bytes
    //    signature: ULEB len (should be 0x40) + 64 bytes

    const sigLen = bytes[bytes.length - 65] // byte right before the 64 sig bytes
    if (sigLen !== 0x40) throw new Error(`Unexpected signature length tag: 0x${sigLen.toString(16)}`)
    const signature = bytes.slice(bytes.length - 64)

    const pkLenIdx = bytes.length - 65 - 33 // 1 (pk len) + 32 (pk) + 1 (sig len) + 64 (sig)
    const pkLen = bytes[pkLenIdx]
    if (pkLen !== 0x20) throw new Error(`Unexpected pubkey length tag: 0x${pkLen.toString(16)}`)
    const pubkey = bytes.slice(pkLenIdx + 1, pkLenIdx + 1 + 32)

    const variant = bytes[pkLenIdx - 1]
    if (variant !== 0x00) {
      // 0x01 would be multiEd25519 etc. You can extend this if you ever get other variants.
      throw new Error(`Unsupported authenticator variant: 0x${variant.toString(16)}`)
    }

    return { variant, pubkey, signature }
  }

  // Parse public key from various formats
  const parsePubKey = (publicKey: string | Uint8Array | Hex): Ed25519PublicKey => {
    let pkBytes: Uint8Array
    if (typeof publicKey === 'string') {
      pkBytes = Hex.fromHexString(publicKey).toUint8Array()
    } else if (publicKey instanceof Hex) {
      pkBytes = publicKey.toUint8Array()
    } else {
      pkBytes = publicKey
    }
    return new Ed25519PublicKey(pkBytes)
  }

  // Create nonce public key
  const noncePubKey = (nonce: number): Ed25519PublicKey => {
    const pubKey = new Uint8Array(Ed25519PublicKey.LENGTH)
    const deployerBuf = Hex.fromHexString(MSAFE_MODULES_ACCOUNT).toUint8Array()
    pubKey.set(deployerBuf.slice(0, 16), 0)
    
    // Write nonce as little-endian 32-bit integer
    const nonceBytes = new Uint8Array(4)
    const view = new DataView(nonceBytes.buffer)
    view.setUint32(0, nonce, true) // true for little-endian
    pubKey.set(nonceBytes, 16)
    
    return new Ed25519PublicKey(pubKey)
  }

  // Calculate MSafe address based on owners, threshold, and nonce
  const computeMultiSigAddress = useCallback((owners: string[] | Uint8Array[] | Hex[], threshold: number, nonce: bigint) => {
    const publicKeys: Ed25519PublicKey[] = owners.map((owner) => {
      return parsePubKey(owner)
    })
    
    if (nonce !== IMPORT_NONCE) {
      publicKeys.push(noncePubKey(Number(nonce)))
    }
    
    const multiPubKey = new MultiEd25519PublicKey({publicKeys, threshold})
    const authKey = AuthenticationKey.fromPublicKey({ publicKey: multiPubKey })
    
    return authKey.derivedAddress()
  }, [IMPORT_NONCE])

  const testSignTransaction = async () => {
    if (!account?.address || !account?.publicKey) {
      setResult({ type: 'error', message: "Account information not available" })
      return
    }

    // 1) Build a RawTransaction with the TS SDK
    const tx = await aptos.transaction.build.simple({
      sender: account.address,
      data: {
        function: "0x1::aptos_account::transfer",
        functionArguments: [owners[0], 10_000_000n],
      },
    });

    // 2) Ask the wallet to SIGN ONLY
    const senderAuthenticator = await signTransaction({
      transactionOrPayload: tx,
    }); // <-- AccountAuthenticator

    console.log('senderAuthenticator', senderAuthenticator)
  }

  // Create new MSafe wallet
  const createNewMSafe = async () => {
    if (!account?.address || !account?.publicKey) {
      setResult({ type: 'error', message: "Account information not available" })
      return
    }

    if (!calculatedMSafeAddress) {
      setResult({ type: 'error', message: "Cannot calculate MSafe address. Ensure all owners are registered." })
      return
    }

    if (owners.length === 0 || threshold <= 1 || threshold > owners.length) {
      setResult({ type: 'error', message: "Invalid owners or threshold configuration" })
      return
    }

    // Validate all owner addresses are filled
    if (owners.some(owner => !owner.trim())) {
      setResult({ type: 'error', message: "All owner addresses must be filled" })
      return
    }

    // Validate all owners are registered (have public keys)
    if (ownerPubKeys.some(key => !key)) {
      setResult({ type: 'error', message: "All owners must be registered in MSafe registry first" })
      return
    }

    setIsCreatingMSafe(true)
    setResult(null)

    try {
      // Use already fetched owner public keys and calculated address
      const msafeAddress = calculatedMSafeAddress
      
      console.log('Calculated MSafe address:', msafeAddress.toString())
      console.log('Owners:', owners)
      console.log('Threshold:', threshold)
      console.log('Creation nonce:', creationNonce.toString())


      if (wallet && wallet.name === "Petra") {
        console.log('Signing transaction with Petra...')
        const tx = await aptos.transaction.build.simple({
          sender:  msafeAddress.toString(),
          data: {
            function: `${MSAFE_MODULES_ACCOUNT}::momentum_safe::register`,
            functionArguments: [META], // or: [new TextEncoder().encode(META)],
            typeArguments: [],
          },
          options: {
            gasUnitPrice: GAS_PX,
            maxGasAmount: MAX_GAS,
            // expireTimestamp: EXP,
            accountSequenceNumber: 0,
            // replayProtectionNonce: undefined,
          },
        });
      
        const senderAuthenticator = await signTransaction({
          transactionOrPayload: tx,
        }); // <-- AccountAuthenticator

        console.log('senderAuthenticator', senderAuthenticator)

        return
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(wallet as any)?.isPontem) {
        setResult({ type: 'error', message: "Only Pontem wallet is supported for MSafe creation" })
        return
      }
      
      // Use Pontem provider for transaction signing with proper configuration
      const provider = (window as { pontem?: PontemProvider }).pontem
      if (!provider) throw new Error("Pontem provider not found on window")
      
      try { 
        await provider.switchNetwork?.(CHAINID) 
      } catch {
        console.log("Network switch not needed or failed")
      }

      const payload = {
        function: `${MSAFE_MODULES_ACCOUNT}::momentum_safe::register`,
        type_arguments: [],
        arguments: [META], // or: [new TextEncoder().encode(META)]
      }

      const opts = {
        sender: msafeAddress.toString(),
        sequence_number: SEQ,
        max_gas_amount: MAX_GAS,
        gas_unit_price: GAS_PX,
        expiration_timestamp_secs: EXP,
      }


      // Sign only (no submit)
      const ret = await provider.signTransaction(payload, opts)
      console.log('ret', ret)
      const signedBytes = ret instanceof Uint8Array ? ret : ret.result
      if (!signedBytes) throw new Error("Failed to get signed transaction bytes")

      // --- extract & print JUST the signature (and pubkey) ---
      const { variant, pubkey, signature } = extractSigFromSignedTx(signedBytes)
      console.log("authenticator variant:", variant)         // 0 => Ed25519
      console.log("trx (hex):", toHex(signedBytes))            
      console.log("pubkey (hex):", toHex(pubkey))            // 32 bytes
      console.log("signature (hex):", toHex(signature))      // 64 bytes


      // Raw Transaction Hex
      const trxHex = '0xb5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193' + toHex(signedBytes).slice(0, -128).slice(2).slice(0,-70)

      // blob for debugging:
      console.log("trxHex:", trxHex)

      console.log('provider', provider);

      // Now submit the init_wallet_creation transaction
      const submitPayload = {
        function: `${MSAFE_MODULES_ACCOUNT}::creator::init_wallet_creation`,
        type_arguments: [],
        arguments: [
          owners,
          threshold,
          String(parseFloat(initBalance) * 10 ** 8),
          trxHex, 
          toHex(signature)
        ]
      }

      const submitOpts = {
        // Should be owner address I think, not msafe address
        // sender: msafeAddress.toString(),
        sequence_number: 0, // Will be filled by the provider
        max_gas_amount: MAX_GAS,
        gas_unit_price: GAS_PX,
        expiration_timestamp_secs: Math.floor(Date.now() / 1000) + 30 // 30 seconds from now
      }

      console.log('Submitting init_wallet_creation transaction...')
      const submitResult = await provider.signAndSubmit(submitPayload as TransactionPayload, submitOpts)
      
      console.log('Transaction submitted:', submitResult)
      
      if (submitResult.success) {
        console.log('MSafe creation transaction submitted successfully!')
        
        // Wait a bit and then recheck registration status to see the new MSafe
        setTimeout(async () => {
          await checkRegistration()
        }, 2000)
        
        const txHash = (submitResult.result as { hash?: string })?.hash || 'N/A'
        setResult({
          type: 'success',
          message: `MSafe creation transaction submitted! Hash: ${txHash}`,
          data: {
            msafeAddress: msafeAddress.toString(),
            owners,
            threshold: Number(threshold),
            initBalance: Number(initBalance),
            transactionHash: txHash
          }
        })
      } else {
        throw new Error('Transaction submission failed')
      }
      
    } catch (err) {
      const error = err as Error
      setResult({ type: 'error', message: `MSafe creation failed: ${error.message}` })
      console.error("MSafe creation error:", error)
    } finally {
      setIsCreatingMSafe(false)
    }
  }

  // Register in MSafe registry
  const registerInMSafe = async () => {
    if (!account?.address || !account?.publicKey) {
      setResult({ type: 'error', message: "Account information not available" })
      return
    }

    setIsRegistering(true)
    setResult(null)

    try {
      // Submit transaction
      const response = await signAndSubmitTransaction({
        sender: account.address,
        data: {
          function: `${MSAFE_MODULES_ACCOUNT}::registry::register`,
          functionArguments: [
            // Convert public key to bytes array for BCS serialization
            Array.from(new Ed25519PublicKey(account.publicKey.toString()).toUint8Array())
          ]
        }
      })
      
      // Wait for transaction confirmation
      await aptos.waitForTransaction({
        transactionHash: response.hash
      })

      // Recheck registration status
      await checkRegistration()
      setResult({ type: 'success', message: 'Successfully registered in MSafe registry!' })
      
    } catch (err) {
      const error = err as Error
      setResult({ type: 'error', message: `Registration failed: ${error.message}` })
      console.error("Registration error:", error)
    } finally {
      setIsRegistering(false)
    }
  }

  // Initialize owners with current account address
  useEffect(() => {
    if (account?.address && owners.length === 0) {
      setOwners([account.address.toString()])
    }
  }, [account?.address, owners.length])

  // State for storing owner public keys from registry
  const [ownerPubKeys, setOwnerPubKeys] = useState<string[]>([])
  const [isLoadingPubKeys, setIsLoadingPubKeys] = useState(false)
  const [creationNonce, setCreationNonce] = useState<bigint>(0n)

  // Fetch public keys from registry when owners change
  useEffect(() => {
    const fetchOwnerPubKeys = async () => {
      if (owners.length === 0 || !connected) {
        setOwnerPubKeys([])
        return
      }

      setIsLoadingPubKeys(true)
      try {
        const pubKeys: string[] = []
        for (const owner of owners) {
          if (!owner.trim()) {
            pubKeys.push("")
            continue
          }
          
          try {
            const registryData = await aptos.getAccountResource({
              accountAddress: owner.trim(),
              resourceType: `${MSAFE_MODULES_ACCOUNT}::registry::OwnerMomentumSafes`
            })
            
            if (registryData?.public_key) {
              pubKeys.push(registryData.public_key as string)
            } else {
              pubKeys.push("")
            }
          } catch {
            // Owner not registered in registry
            pubKeys.push("")
          }
        }
        setOwnerPubKeys(pubKeys)
      } catch (error) {
        console.error("Error fetching owner public keys:", error)
        setOwnerPubKeys([])
      } finally {
        setIsLoadingPubKeys(false)
      }
    }

    fetchOwnerPubKeys()
  }, [owners, connected, aptos])

  // Helper functions for nonce retrieval
  const getCreatorResourceData = useCallback(async (): Promise<PendingMultiSigCreations | null> => {
    if (!aptos) return null
    
    try {
      const resourceType = `${MSAFE_MODULES_ACCOUNT}::creator::PendingMultiSigCreations`
      const resource = await aptos.getAccountResource({
        accountAddress: MSAFE_MODULES_ACCOUNT,
        resourceType
      })
      return resource as PendingMultiSigCreations
    } catch (error) {
      console.error("Failed to get creator resource data:", error)
      return null
    }
  }, [aptos])

  const queryNonce = useCallback(async (creations: PendingMultiSigCreations, initiator: string): Promise<string> => {
    if (!aptos) return "0"
    
    try {
      const nonce = await aptos.getTableItem({
        handle: creations.nonces.handle,
        data: {
          key_type: 'address',
          value_type: 'u64',
          key: initiator.startsWith('0x') ? initiator.slice(2) : initiator
        }
      })
      return nonce as string
    } catch (error) {
      // If nonce not found, return "0" (first creation for this initiator)
      if (error instanceof Error && error.message.includes('table_item_not_found')) {
        return "0"
      }
      console.error("Failed to query nonce:", error)
      return "0"
    }
  }, [aptos])

  const getNonce = useCallback(async (initiator: string): Promise<bigint> => {
    const creations = await getCreatorResourceData()
    if (!creations) return 0n
    
    const nonce = await queryNonce(creations, initiator)
    return BigInt(nonce)
  }, [getCreatorResourceData, queryNonce])

  // Fetch nonce when first owner changes
  useEffect(() => {
    const firstOwner = owners[0]
    const fetchNonce = async () => {
      if (firstOwner && connected && aptos) {
        try {
          const nonce = await getNonce(firstOwner)
          setCreationNonce(nonce)
        } catch (error) {
          console.error("Failed to fetch nonce:", error)
          setCreationNonce(0n)
        }
      } else {
        setCreationNonce(0n)
      }
    }

    fetchNonce()
  }, [owners, connected, aptos, getNonce])

  // Calculate MSafe address based on current owners and threshold
  const calculatedMSafeAddress = useMemo(() => {
    if (owners.length === 0 || threshold < 1 || threshold > owners.length || ownerPubKeys.length !== owners.length) {
      return null
    }

    try {
      // Check if all owners have public keys (are registered)
      if (ownerPubKeys.some(key => !key)) return null

      // Use the real nonce from the contract
      return computeMultiSigAddress(ownerPubKeys, threshold, creationNonce)
    } catch (error) {
      console.error("Failed to calculate MSafe address:", error)
      return null
    }
  }, [owners, threshold, ownerPubKeys, computeMultiSigAddress, creationNonce])

  // Functions for managing owners array
  const addOwner = () => {
    setOwners([...owners, ""])
  }

  const removeOwner = (index: number) => {
    if (index === 0) return // Cannot remove first owner (current account)
    setOwners(owners.filter((_, i) => i !== index))
    // Adjust threshold if it's higher than remaining owners count
    if (threshold > owners.length - 1) {
      setThreshold(owners.length - 1)
    }
  }

  const updateOwner = (index: number, address: string) => {
    if (index === 0) return // Cannot update first owner (current account)
    const newOwners = [...owners]
    newOwners[index] = address
    setOwners(newOwners)
  }

  // Check registration when wallet connects
  useEffect(() => {
    if (connected && account?.address) {
      checkRegistration()
    } else {
      setIsRegistered(null)
      setRegistryData(null)
    }
  }, [connected, account, checkRegistration])

  if (!connected || !account?.address) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          MSafe Registry Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Result Display */}
        {result && (
          <div className={`p-3 rounded-lg border ${
            result.type === 'success' 
              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
              : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              {result.type === 'success' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <XCircle className="h-4 w-4 text-red-600" />
              )}
              <span className={`text-sm font-medium ${
                result.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                {result.type === 'success' ? 'Success' : 'Error'}
              </span>
            </div>
            <Textarea
              value={result.message}
              readOnly
              className={`text-xs font-mono resize-none ${
                result.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800'
              }`}
              rows={result.message.split('\n').length}
            />
          </div>
        )}
        
        {/* Registration Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Registration Status:</span>
            {isChecking ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                <span>Checking...</span>
              </div>
            ) : isRegistered === null ? (
              <span className="text-gray-500">Unknown</span>
            ) : isRegistered ? (
              <span className="text-green-500 font-medium">Registered</span>
            ) : (
              <span className="text-red-500 font-medium">Not Registered</span>
            )}
          </div>
          
          {!isChecking && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => checkRegistration()}
            >
              Refresh
            </Button>
          )}
        </div>

        {/* Registration Details */}
        {isRegistered && registryData && (
          <div className="space-y-3 p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-600">Registered in MSafe</span>
              </div>
            </div>

            {/* MSafe Creation Form */}
            <div className="space-y-4 p-4 bg-background border rounded-lg">
              <h4 className="text-sm font-medium">Create New MSafe Wallet</h4>
              
              {/* Owners Configuration */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Owners</Label>
                {owners.map((owner, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={owner}
                      onChange={(e) => updateOwner(index, e.target.value)}
                      placeholder={index === 0 ? "Your address (cannot be changed)" : "Owner address"}
                      disabled={index === 0}
                      className={`text-xs font-mono ${index === 0 ? 'bg-muted' : ''}`}
                    />
                    {index > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeOwner(index)}
                        className="p-1 h-8 w-8"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addOwner}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Owner
                </Button>
              </div>

              {/* Threshold Configuration */}
              <div className="space-y-2">
                <Label htmlFor="threshold" className="text-sm font-medium">
                  Threshold ({threshold}/{owners.length})
                </Label>
                <Input
                  id="threshold"
                  type="number"
                  min="1"
                  max={owners.length}
                  value={threshold}
                  onChange={(e) => setThreshold(Math.min(Math.max(1, parseInt(e.target.value) || 1), owners.length))}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Number of signatures required to execute transactions
                </p>
              </div>

              {/* Initial Balance Configuration */}
              <div className="space-y-2">
                <Label htmlFor="initBalance" className="text-sm font-medium">
                  Initial Balance (APT)
                </Label>
                <Input
                  id="initBalance"
                  type="number"
                  step="0.01"
                  min="0"
                  value={initBalance}
                  onChange={(e) => setInitBalance(e.target.value)}
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Initial balance to fund the MSafe wallet
                </p>
              </div>

              {/* Owner Registration Status */}
              {owners.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Owner Registration Status</Label>
                  <div className="space-y-1">
                    {owners.map((owner, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <span className="font-mono text-muted-foreground truncate flex-1">
                          {owner || "Empty"}
                        </span>
                        {isLoadingPubKeys ? (
                          <Badge variant="secondary">Loading...</Badge>
                        ) : ownerPubKeys[index] ? (
                          <Badge variant="default">Registered</Badge>
                        ) : (
                          <Badge variant="destructive">Not Registered</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Calculated MSafe Address */}
              {calculatedMSafeAddress && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Calculated MSafe Address (Nonce: {creationNonce.toString()})</Label>
                  <div className="p-2 bg-muted rounded text-xs font-mono break-all">
                    {calculatedMSafeAddress.toString()}
                  </div>
                </div>
              )}
              
              {/* Address calculation status */}
              {!calculatedMSafeAddress && owners.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">MSafe Address</Label>
                  <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                    {isLoadingPubKeys 
                      ? "Loading owner public keys..." 
                      : ownerPubKeys.some(key => !key)
                        ? "All owners must be registered first"
                        : "Calculating address..."}
                  </div>
                </div>
              )}

              {/* Create Button */}
              <LoadingButton
                onClick={createNewMSafe}
                loading={isCreatingMSafe}
                className="w-full"
                disabled={!calculatedMSafeAddress || owners.some(owner => !owner.trim()) || isLoadingPubKeys}
              >
                {isCreatingMSafe ? "Creating..." : "Create MSafe Wallet"}
              </LoadingButton>

              {/* Test Sign Transaction Button */}
              <Button
                onClick={testSignTransaction}
                variant="outline"
                className="w-full"
                disabled={owners.length === 0 || !owners[0]}
              >
                Test Sign Transaction
              </Button>
            </div>
            
            <div className="grid gap-2 text-xs">
              <div>
                <span className="font-medium">Public Key:</span>
                <div className="font-mono text-muted-foreground break-all">
                  {registryData.publicKey}
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="font-medium">MSafe Wallets:</span>
                <Badge variant="secondary">
                  {registryData.msafes.length} active
                </Badge>
                {registryData.pendings.length > 0 && (
                  <Badge variant="outline">
                    {registryData.pendings.length} pending
                  </Badge>
                )}
              </div>
              
              {/* Active MSafe Wallets List */}
              {registryData.msafes.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-green-600">Active MSafe Wallets:</span>
                  <div className="space-y-1">
                    {registryData.msafes.map((msafeAddress, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                          <span className="font-mono text-muted-foreground overflow-hidden  truncate">
                            {msafeAddress}
                          </span>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          Active
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Pending MSafe Wallets List */}
              {registryData.pendings.length > 0 && (
                <div className="space-y-2">
                  <span className="text-xs font-medium text-yellow-600">Pending MSafe Wallets:</span>
                  <div className="space-y-1">
                    {registryData.pendings.map((msafeAddress, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                          <span className="font-mono text-muted-foreground overflow-hidden  truncate">
                            {msafeAddress}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          Pending
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Registration Action */}
        {isRegistered === false && (
          <div className="space-y-3 p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-600">Registration Required</span>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Your wallet needs to be registered in the MSafe registry before you can create or participate in multisig wallets.
            </p>
            
            <LoadingButton
              onClick={registerInMSafe}
              loading={isRegistering}
              className="w-full"
              variant="default"
            >
              {isRegistering ? "Registering..." : "Register in MSafe"}
            </LoadingButton>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
