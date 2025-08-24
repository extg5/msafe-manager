import { useState, useEffect, useCallback, useMemo } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Aptos, AptosConfig, Network, Ed25519PublicKey } from "@aptos-labs/ts-sdk"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { ErrorDisplay } from "@/components/error-display"
import { Shield, UserCheck, UserPlus } from "lucide-react"

// MSafe deployer address for Mainnet from the official documentation
// https://doc.m-safe.io/aptos/developers/system/msafe-contracts#deployed-smart-contract
const MSAFE_MODULES_ACCOUNT = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"
const REGISTRY_MODULE = "registry"

interface RegistryData {
  publicKey: string
  pendings: string[]
  msafes: string[]
}

interface MSafeRegistryCheckerProps {
  onRegistrationStatusChange?: (isRegistered: boolean) => void
}

export function MSafeRegistryChecker({ onRegistrationStatusChange }: MSafeRegistryCheckerProps) {
  const { account, connected, signAndSubmitTransaction } = useWallet()
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null)
  const [registryData, setRegistryData] = useState<RegistryData | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isRegistering, setIsRegistering] = useState(false)
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
      // Try to get registry resource for the account
      // В реальной реализации здесь будет правильный вызов API
      // Пример:
      const resource = await aptos.getAccountResource({
        accountAddress: account.address,
        resourceType: `${MSAFE_MODULES_ACCOUNT}::registry::OwnerMomentumSafes`
      })

      console.log('res', resource)

      if (resource) {
        const registryData: RegistryData = {
          publicKey: resource.public_key as string,
          pendings: (resource.pendings as string[]) || [],
          msafes: (resource.msafes as string[]) || []
        }
        
        setRegistryData(registryData)
        setIsRegistered(true)
        onRegistrationStatusChange?.(true)
      }
    } catch (err) {
      const error = err as Error
      if (error.message?.includes("Resource not found") || (err as { status?: number }).status === 404) {
        setIsRegistered(false)
        setRegistryData(null)
        onRegistrationStatusChange?.(false)
      } else {
        setError(`Failed to check registration: ${error.message}`)
        console.error("Registration check error:", error)
      }
    } finally {
      setIsChecking(false)
    }
  }, [account, aptos, onRegistrationStatusChange])

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
          function: `${MSAFE_MODULES_ACCOUNT}::${REGISTRY_MODULE}::register`,
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
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-green-600" />
              <span className="text-sm font-medium text-green-600">Registered in MSafe</span>
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
