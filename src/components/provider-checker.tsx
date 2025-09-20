import { useState, useEffect } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Hex } from "@aptos-labs/ts-sdk"
import { Deserializer, SignedTransaction } from "@aptos-labs/ts-sdk"

// Pontem Provider interface
interface PontemProvider {
  signTransaction(payload: unknown, opts: unknown): Promise<Uint8Array | { result: Uint8Array }>
  switchNetwork?(chainId: string): Promise<void>
}

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { WalletModal } from "./wallet-modal"
import { SignatureDisplay } from "./signature-display"
import { ErrorDisplay } from "./error-display"
import { MSafeAccountSelector } from "./msafe-account-selector"

interface ProviderCheckerProps {
  onSignatureChange?: (signature: string) => void
}

export function ProviderChecker({ onSignatureChange }: ProviderCheckerProps) {
  // Default transaction payload for testing
  const defaultPayload = JSON.stringify({
    "function": "0x1::coin::transfer",
    "type_arguments": ["0x0000000000000000000000000000000000000000000000000000000000000001::aptos_coin::AptosCoin"],
    "arguments": ["0x3311cd72df40ff27ba05d3ad80f8d72334d24b7fcafc284e52acf244580236d4", "100000"]
  }, null, 2)

  const [payload, setPayload] = useState(defaultPayload)
  const [signature, setSignature] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [selectedMSafeAccount, setSelectedMSafeAccount] = useState<string>("")

  const { connected, account, wallet } = useWallet()

  useEffect(() => {
    console.log('Provider Checker - account:', account)
    console.log('Provider Checker - wallet:', wallet)
    // @ts-expect-error test
    console.log('Provider Checker - wallet.signTransaction:', wallet?.signTransaction)
  }, [account, wallet])

  const signTransactionWithWallet = async () => {
    if (!connected || !account) {
      setError("Wallet not connected")
      return
    }

    if (!payload.trim()) {
      setError("Enter transaction payload")
      return
    }

    setIsLoading(true)
    setError("")
    setSignature("")

    try {
      // Parse the JSON payload
      let parsedPayload
      try {
        parsedPayload = JSON.parse(payload)
      } catch (parseError) {
        throw new Error("Invalid JSON payload")
      }

      // Use Pontem provider for transaction signing with proper configuration
      const provider = (window as { pontem?: PontemProvider }).pontem
      if (!provider) throw new Error("Pontem provider not found on window")
      
      try { 
        await provider.switchNetwork?.("1") // mainnet
      } catch {
        console.log("Network switch not needed or failed")
      }

      // Use the parsed payload directly (should already have function, type_arguments, arguments)
      const transactionPayload = parsedPayload

      // Use MSafe account as sender if selected, otherwise use wallet account
      const senderAddress = selectedMSafeAccount || account.address.toString()
      
      // Transaction options - using some defaults
      const opts = {
        sender: senderAddress,
        sequence_number: "0", // Will be filled by provider
        max_gas_amount: "100000",
        gas_unit_price: "100",
        expiration_timestamp_secs: Math.floor(Date.now() / 1000) + 600, // 10 minutes from now
      }

      console.log('Transaction payload:', transactionPayload)
      console.log('Transaction opts:', opts)

      // Sign only (no submit)
      const ret = await provider.signTransaction(transactionPayload, opts)
      console.log('Provider response:', ret)

      
      const signedBytes = ret instanceof Uint8Array ? ret : ret.result
      const deserializer = new Deserializer(signedBytes)
      const tx = SignedTransaction.deserialize(deserializer);

      console.log('Signed transaction:', tx)

      // code from MSafe app
      //  try {
      //     const t = await provider.signTransaction(transactionPayload, opts)
      //       , n = new Deserializer(t.result)
      //       , tx = SignedTransaction.deserialize(n);
      //     return Number(tx.raw_txn.expiration_timestamp_secs) !== Number(e.raw.expiration_timestamp_secs) ? (IW.calibration += Number(tx.raw_txn.expiration_timestamp_secs) - Number(e.raw.expiration_timestamp_secs),
      //     IW.calibration = Math.round(IW.calibration / 2),
      //     this.walletSignTxnImpl(e)) : tx
      // } catch (Ek) {
      //     throw Ek
      // }


      
      if (!signedBytes) throw new Error("Failed to get signed transaction bytes")

      // Convert to hex string
      const hexSignature = Hex.fromHexInput(signedBytes).toString()
      setSignature(hexSignature)
      
      // Notify parent component
      if (onSignatureChange) {
        onSignatureChange(hexSignature)
      }

    } catch (error) {
      console.error("Error signing transaction:", error)
      setError(error instanceof Error ? error.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const clearResults = () => {
    setSignature("")
    setError("")
    if (onSignatureChange) {
      onSignatureChange("")
    }
  }

  const resetToDefault = () => {
    setPayload(defaultPayload)
    clearResults()
  }

  return (
    <div className="space-y-4">
      {/* MSafe Account Selector */}
      <div className="space-y-2">
        <Label htmlFor="msafe-account">MSafe Account (Optional)</Label>
        <MSafeAccountSelector
          value={selectedMSafeAccount}
          onValueChange={setSelectedMSafeAccount}
          placeholder="Select MSafe account or use wallet account"
        />
        {selectedMSafeAccount && (
          <p className="text-xs text-muted-foreground">
            Using MSafe account as sender: {selectedMSafeAccount.slice(0, 6)}...{selectedMSafeAccount.slice(-4)}
          </p>
        )}
      </div>

      {/* Payload Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="payload">Transaction Payload (JSON)</Label>
          <Button 
            variant="outline" 
            size="sm"
            onClick={resetToDefault}
            className="text-xs"
          >
            Reset to Default
          </Button>
        </div>
        <Textarea
          id="payload"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder="Enter transaction payload as JSON..."
          className="min-h-[120px] font-mono text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <LoadingButton 
          onClick={signTransactionWithWallet}
          disabled={!payload.trim() || !connected}
          loading={isLoading}
          loadingText="Signing Transaction..."
          className="flex-1"
        >
          Sign Transaction
        </LoadingButton>
        <Button 
          variant="outline" 
          onClick={clearResults}
          disabled={!signature && !error}
        >
          Clear
        </Button>
      </div>

      {/* Error Display */}
      <ErrorDisplay error={error} onClear={() => setError("")} />

      {/* Results */}
      <SignatureDisplay signature={signature} onClose={clearResults} />
      
      <WalletModal 
        open={isWalletModalOpen} 
        onOpenChange={setIsWalletModalOpen} 
      />
    </div>
  )
}
