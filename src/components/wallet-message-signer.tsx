import { useState, useEffect } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Hex } from "@aptos-labs/ts-sdk"

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { WalletModal } from "./wallet-modal"
import { SignatureDisplay } from "./signature-display"
import { MessageHexInput } from "./message-hex-input"
import { hexUtils } from "@/components/form"
import { ErrorDisplay } from "./error-display"

interface WalletMessageSignerProps {
  onSignatureChange?: (signature: string) => void
}

export function WalletMessageSigner({ onSignatureChange }: WalletMessageSignerProps) {
  const [messageHex, setMessageHex] = useState("b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb010000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e000220a5a18e45d7086798c4e81cbb9d61cdbd131c74a9f8151ed11f1732c73fc9c718080065cd1d00000000e80300000000000078000000000000006a39ac680000000001")
  const [signature, setSignature] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [useNewFormat, setUseNewFormat] = useState(false)

  const { signMessage, connected, account, wallet } = useWallet()

  useEffect(() => {
    console.log('account', account)
    console.log('wallet', wallet)
    // @ts-expect-error test
    console.log('wallet.signMessage', wallet.signMessage)
    // @ts-expect-error test
    console.log('wallet.signMessageV2', wallet.signMessageV2)
  }, [account, wallet])

  const signMessageWithWallet = async () => {
    if (!signMessage || !connected || !account) {
      setError("Wallet not connected")
      return
    }

    if (!messageHex.trim()) {
      setError("Enter hex message")
      return
    }

    setIsLoading(true)
    setError("")
    setSignature("")

    try {
      const validation = hexUtils.validateHex(messageHex)
      if (!validation.isValid) {
        throw new Error(validation.error || "Invalid hex format")
      }

      // Convert hex to bytes and then to string for wallet signing
      // const hexBytes = Hex.fromHexString(`0x${cleanHex}`)
      // Convert bytes to string that wallet can sign
      // const message = hexBytes.toString().slice(2)
      // console.log('original hex:', cleanHex)
      // console.log('message for wallet:', message)
      // Sign message through wallet adapter

      const pontemOpts = { useNewFormat }
      const response = await signMessage({
        message: messageHex.trim(),
        nonce: '',
        // @ts-expect-error - useNewFormat is an optional wallet-specific option
      }, pontemOpts)

      // Convert signature to hex with proper type handling
      if (response && response.signature) {
        console.log('response.signature', response.signature)
        
        let processedSignature: unknown = response.signature
        
        // Handle nested data structures (like Petra wallet)
        if (typeof processedSignature === 'object' && 
            processedSignature !== null &&
            'data' in processedSignature) {
          const signatureData = processedSignature as { data: unknown }
          if (typeof signatureData.data === 'object' && 
              signatureData.data !== null &&
              'data' in signatureData.data) {
            processedSignature = (signatureData.data as { data: unknown }).data
          } else {
            processedSignature = signatureData.data
          }
        }
        
        // Convert to string format
        let finalSignature = ""
        if (typeof processedSignature === 'string') {
          finalSignature = processedSignature
          setSignature(processedSignature)
        } else if (processedSignature instanceof Uint8Array) {
          // If signature is in bytes, convert to hex
          const hexSignature = Hex.fromHexInput(processedSignature).toString()
          finalSignature = hexSignature
          setSignature(hexSignature)
        } else if (processedSignature && typeof processedSignature === 'object' && 'toString' in processedSignature) {
          // Try to use toString method if available
          const stringifiedSignature = (processedSignature as { toString(): string }).toString()
          finalSignature = stringifiedSignature
          setSignature(stringifiedSignature)
        } else {
          finalSignature = JSON.stringify(processedSignature)
          setSignature(JSON.stringify(processedSignature))
        }
        
        // Notify parent component
        if (onSignatureChange) {
          onSignatureChange(finalSignature)
        }
      } else {
        setError("Failed to get signature")
      }

    } catch (error) {
      console.error("Error signing message:", error)
      setError(error instanceof Error ? error.message : "Unknown error")
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



  return (
    <div className="space-y-4">
      {/* Message Input */}
      <MessageHexInput 
        value={messageHex}
        onChange={setMessageHex}
      />

      {/* Options */}
      <div className="flex items-center space-x-2">
        <Input
          type="checkbox"
          id="useNewFormat"
          checked={useNewFormat}
          onChange={(e) => setUseNewFormat(e.target.checked)}
          className="h-4 w-4"
        />
        <Label
          htmlFor="useNewFormat"
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          Use new format (Pontem only)
        </Label>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <LoadingButton 
          onClick={signMessageWithWallet}
          disabled={!messageHex.trim() || !connected}
          loading={isLoading}
          loadingText="Signing..."
          className="flex-1"
        >
          Sign Message
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
