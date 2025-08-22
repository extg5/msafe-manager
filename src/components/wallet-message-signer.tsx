import { useState } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Hex } from "@aptos-labs/ts-sdk"

import { Button } from "@/components/ui/button"
import { WalletModal } from "./wallet-modal"
import { SignatureDisplay } from "./signature-display"

export function WalletMessageSigner() {
  const [messageHex, setMessageHex] = useState("b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb010000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e000220a5a18e45d7086798c4e81cbb9d61cdbd131c74a9f8151ed11f1732c73fc9c718080065cd1d00000000e80300000000000078000000000000006a39ac680000000001")
  const [signature, setSignature] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)

  const { signMessage, connected, account } = useWallet()

  const getMessageStatus = () => {
    if (!messageHex.trim()) return ""
    
    let cleanHex = messageHex.trim()
    if (cleanHex.startsWith('0x')) {
      cleanHex = cleanHex.slice(2)
    }
    
    // Check if it's valid hex
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      return "⚠ Invalid hex format"
    }
    
    if (cleanHex.length === 0) {
      return "⚠ Empty message"
    }
    
    if (cleanHex.length % 2 !== 0) {
      return "⚠ Odd hex string length"
    }
    
    return `✓ Hex message: ${Math.floor(cleanHex.length / 2)} bytes`
  }

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
      let cleanHex = messageHex.trim()
      if (cleanHex.startsWith('0x')) {
        cleanHex = cleanHex.slice(2)
      }

      // Check hex validity
      if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
        throw new Error("Invalid hex format")
      }

      if (cleanHex.length % 2 !== 0) {
        throw new Error("Hex string must have even length")
      }

      // Convert hex to bytes and then to string for wallet signing
      // const hexBytes = Hex.fromHexString(`0x${cleanHex}`)
      // Convert bytes to string that wallet can sign
      // const message = hexBytes.toString().slice(2)
      // console.log('original hex:', cleanHex)
      // console.log('message for wallet:', message)
      // Sign message through wallet adapter
      const response = await signMessage({
        message: messageHex.trim(),
        nonce: ''
      })

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
        if (typeof processedSignature === 'string') {
          setSignature(processedSignature)
        } else if (processedSignature instanceof Uint8Array) {
          // If signature is in bytes, convert to hex
          const hexSignature = Hex.fromHexInput(processedSignature).toString()
          setSignature(hexSignature)
        } else if (processedSignature && typeof processedSignature === 'object' && 'toString' in processedSignature) {
          // Try to use toString method if available
          const stringifiedSignature = (processedSignature as { toString(): string }).toString()
          setSignature(stringifiedSignature)
        } else {
          setSignature(JSON.stringify(processedSignature))
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
  }



  return (
    <div className="space-y-4">
      {/* Message Input */}
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Message Hex (hex string with or without 0x prefix)
          </label>
          <textarea
            value={messageHex}
            onChange={(e) => setMessageHex(e.target.value)}
            placeholder="Enter hex message to sign..."
            className="mt-1 w-full p-3 bg-muted rounded-md font-mono text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            rows={4}
          />
          {messageHex && (
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {getMessageStatus()}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          onClick={signMessageWithWallet}
          disabled={isLoading || !messageHex.trim() || !connected}
          className="flex-1"
        >
          {isLoading ? (
            <>
              <span className="animate-spin mr-2">⟳</span>
              Signing...
            </>
          ) : (
            "Sign Message"
          )}
        </Button>
        <Button 
          variant="outline" 
          onClick={clearResults}
          disabled={!signature && !error}
        >
          Clear
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-3">
          <div className="text-sm text-red-800 dark:text-red-200">
            <strong>Error:</strong> {error}
          </div>
        </div>
      )}

      {/* Results */}
      <SignatureDisplay signature={signature} />
      
      <WalletModal 
        open={isWalletModalOpen} 
        onOpenChange={setIsWalletModalOpen} 
      />
    </div>
  )
}
