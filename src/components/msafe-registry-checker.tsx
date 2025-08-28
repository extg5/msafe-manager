import { useState, useEffect, useCallback, useMemo } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig, Network, Ed25519PublicKey, MultiEd25519PublicKey, AuthenticationKey, Hex } from "@aptos-labs/ts-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { ErrorDisplay } from "@/components/error-display"
import { Shield, UserCheck, UserPlus } from "lucide-react"

// MSafe deployer address for Mainnet from the official documentation
// https://doc.m-safe.io/aptos/developers/system/msafe-contracts#deployed-smart-contract
const MSAFE_MODULES_ACCOUNT = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"

interface TransactionPayload {
  function: string
  type_arguments: string[]
  arguments: string[]
}

interface TransactionOptions {
  sender: string
  sequence_number: number
  max_gas_amount: number
  gas_unit_price: number
  expiration_timestamp_secs: number
}

interface PontemProvider {
  connect: () => Promise<void>
  switchNetwork?: (chainId: number) => Promise<void>
  signTransaction: (payload: TransactionPayload, opts: TransactionOptions) => Promise<{ result?: Uint8Array } | Uint8Array>
}

interface RegistryData {
  publicKey: string
  pendings: string[]
  msafes: string[]
}

interface MSafeRegistryCheckerProps {
  onRegistrationStatusChange?: (isRegistered: boolean) => void
}

export function MSafeRegistryChecker({ onRegistrationStatusChange }: MSafeRegistryCheckerProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { account, connected, signAndSubmitTransaction, signTransaction } = useWallet()
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [registryData, setRegistryData] = useState<RegistryData | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isCreatingMSafe, setIsCreatingMSafe] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize Aptos client для Mainnet
  const aptosConfig = useMemo(() => new AptosConfig({ network: Network.MAINNET }), [])
  const aptos = useMemo(() => new Aptos(aptosConfig), [aptosConfig])

  // Check registration status
  const checkRegistration = useCallback(async () => {
    if (!account?.address) return

    setIsChecking(true)
    setError(null)

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
        setError("Too many requests to API. Please wait a moment and try again.")
        console.error("Rate limit exceeded:", error)
      } else {
        setError(`Failed to check registration: ${error.message}`)
        console.error("Registration check error:", error)
      }
    } finally {
      setIsChecking(false)
    }
  }, [account, aptos, onRegistrationStatusChange])

  console.log('registryData', registryData)

  // MSafe deployer address for Mainnet
  const MSAFE_DEPLOYER = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"
  const IMPORT_NONCE = BigInt('0xffffffffffffffff')

  // === TRANSACTION CONFIG ===
  const META = "Momentum Safe"
  const SEQ = 0
  const MAX_GAS = 12000
  const GAS_PX = 120
  const EXP = 1756555990
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
    const deployerBuf = Hex.fromHexString(MSAFE_DEPLOYER).toUint8Array()
    pubKey.set(deployerBuf.slice(0, 16), 0)
    
    // Write nonce as little-endian 32-bit integer
    const nonceBytes = new Uint8Array(4)
    const view = new DataView(nonceBytes.buffer)
    view.setUint32(0, nonce, true) // true for little-endian
    pubKey.set(nonceBytes, 16)
    
    return new Ed25519PublicKey(pubKey)
  }

  // Calculate MSafe address based on owners, threshold, and nonce
  const computeMultiSigAddress = (owners: string[] | Uint8Array[] | Hex[], threshold: number, nonce: bigint) => {
    const publicKeys: Ed25519PublicKey[] = owners.map((owner) => {
      return parsePubKey(owner)
    })
    
    if (nonce !== IMPORT_NONCE) {
      publicKeys.push(noncePubKey(Number(nonce)))
    }
    
    const multiPubKey = new MultiEd25519PublicKey({publicKeys, threshold})
    const authKey = AuthenticationKey.fromPublicKey({ publicKey: multiPubKey })
    
    return authKey.derivedAddress()
  }

  // Create new MSafe wallet
  const createNewMSafe = async () => {
    if (!account?.address || !account?.publicKey) {
      setError("Account information not available")
      return
    }

    setIsCreatingMSafe(true)
    setError(null)

    try {
      // Create a simple multi-owner MSafe
      const owners = [
        account.address, '0x5a047d093b7e65201a3a9b666f11caa74b8b631b63976610bc671a1a33a27bab', '0x1642653ef5cc888184722e47704205d76b56ffdc97782856f3376dc717d7e4f5',
      ]
      const threshold = 2
      // const initBalance = 20000000n // Start with 0.2 balance

      // Get public keys from registry for all owners
      const ownerPubKeys = []
      for (const owner of owners) {
        try {
          console.log('owner', owner)
          const registryData = await aptos.getAccountResource({
            accountAddress: owner,
            resourceType: `${MSAFE_MODULES_ACCOUNT}::registry::OwnerMomentumSafes`
          })
          if (registryData) {
            ownerPubKeys.push(registryData.public_key || registryData.publicKey)
          }
        } catch {
          setError(`Owner ${owner} is not registered in MSafe registry`)
          return
        }
      }

      console.log('ownerPubKeys', ownerPubKeys);

      // TODO: fetch nonce from msafe table
      const creationNonce = 0n // Use timestamp as nonce for demo
      const msafeAddress = computeMultiSigAddress(ownerPubKeys, threshold, creationNonce)
      
      console.log('Calculated MSafe address:', msafeAddress.toString())
      console.log('Calculated MSafe address:', msafeAddress.toString() === '0x0df5d0cc432314d929d67831192ce9af1a0279a6fd5a6f88b449fd55a0fd9ea7')
      console.log('Owners:', owners)
      console.log('Threshold:', threshold)
      console.log('Creation nonce:', creationNonce.toString())

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
      const signedBytes = ret instanceof Uint8Array ? ret : ret.result
      if (!signedBytes) throw new Error("Failed to get signed transaction bytes")

      // --- extract & print JUST the signature (and pubkey) ---
      const { variant, pubkey, signature } = extractSigFromSignedTx(signedBytes)
      console.log("authenticator variant:", variant)         // 0 => Ed25519
      console.log("pubkey (hex):", toHex(pubkey))            // 32 bytes
      console.log("signature (hex):", toHex(signature))      // 64 bytes

      // blob for debugging:
      console.log("SignedTransaction (hex):", toHex(signedBytes))
      
      // // Now create the MSafe creation transaction with the signed payload
      // const response = await signAndSubmitTransaction({
      //   sender: account.address,
      //   data: {
      //     function: `${MSAFE_MODULES_ACCOUNT}::creator::init_wallet_creation`,
      //     functionArguments: [
      //       // Serialize owners array (vector of addresses)
      //       owners,
      //       // Threshold as u8
      //       threshold,
      //       // Initial balance as u64
      //       initBalance.toString(),
      //       // Payload (signed register transaction)
      //       registerResponse.payload,
      //       // Signature
      //       registerResponse.signature
      //     ]
      //   }
      // })
      
      // // Wait for transaction confirmation
      // await aptos.waitForTransaction({
      //   transactionHash: response.hash
      // })

      // Recheck registration status to see the new MSafe
      // await checkRegistration()
      
      setError(`MSafe transaction signed successfully!
      Calculated address: ${msafeAddress}
      Signature: ${toHex(signature)}
      Public key: ${toHex(pubkey)}
      Authenticator variant: ${variant}`)
      
    } catch (err) {
      const error = err as Error
      setError(`MSafe creation failed: ${error.message}`)
      console.error("MSafe creation error:", error)
    } finally {
      setIsCreatingMSafe(false)
    }
  }

  // Register in MSafe registry
  const registerInMSafe = async () => {
    if (!account?.address || !account?.publicKey) {
      setError("Account information not available")
      return
    }

    setIsRegistering(true)
      setError(null)

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
      
    } catch (err) {
      const error = err as Error
      setError(`Registration failed: ${error.message}`)
      console.error("Registration error:", error)
    } finally {
      setIsRegistering(false)
    }
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
        {error && <ErrorDisplay error={error} />}
        
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
              <LoadingButton
                onClick={createNewMSafe}
                loading={isCreatingMSafe}
                size="sm"
                variant="outline"
              >
                {isCreatingMSafe ? "Creating..." : "Create New MSafe"}
              </LoadingButton>
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
