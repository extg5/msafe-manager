import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Eye, EyeOff } from "lucide-react"
import { SignatureDisplay } from "./signature-display"
import { MessageHexInput } from "./message-hex-input"

interface CustomKeySignerProps {
  onSignatureChange?: (signature: string) => void
}

export function CustomKeySigner({ onSignatureChange }: CustomKeySignerProps) {
  const [privateKey, setPrivateKey] = useState("")
  const [messageHex, setMessageHex] = useState("b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb010000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e000220a5a18e45d7086798c4e81cbb9d61cdbd131c74a9f8151ed11f1732c73fc9c718080065cd1d00000000e80300000000000078000000000000006a39ac680000000001")

  const [signature, setSignature] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [showSignatureDetails] = useState(true)




  const getKeyStatus = () => {
    if (!privateKey.trim()) return ""
    
    let cleanKey = privateKey.trim()
    if (cleanKey.startsWith('0x')) {
      cleanKey = cleanKey.slice(2)
    }
    
    if (cleanKey.length === 64) {
      return `✓ Key entered: ${cleanKey.slice(0, 4)}...${cleanKey.slice(-4)}`
    } else {
      return `⚠ Invalid key length: ${cleanKey.length}/64 chars`
    }
  }

  const signWithCustomKey = async () => {
    setIsLoading(true)
    setSignature("")
    
    try {
      const { Ed25519PrivateKey, Account } = await import("@aptos-labs/ts-sdk")
      
      if (!privateKey.trim()) {
        throw new Error("Private key is required")
      }
      
      let privateKeyHex = privateKey.trim()
      
      // Remove 0x prefix if present
      if (privateKeyHex.startsWith('0x')) {
        privateKeyHex = privateKeyHex.slice(2)
      }
      
      // Check key length
      if (privateKeyHex.length !== 64) {
        throw new Error(`Private key must be exactly 64 hex characters (32 bytes), got ${privateKeyHex.length}`)
      }
      
      const privateKeyObj = new Ed25519PrivateKey(`0x${privateKeyHex}`)
      const account = Account.fromPrivateKey({ privateKey: privateKeyObj })
      
      const signature = account.sign(`0x${messageHex}`)
      const signatureStr = signature.toString()
      
      // Save signature to state
      setSignature(signatureStr)
      
      // Notify parent component
      if (onSignatureChange) {
        onSignatureChange(signatureStr)
      }
      
    } catch (error) {
      console.error("Error with custom key:", error)
      // You could show a simple error toast or notification here if needed
      alert(error instanceof Error ? error.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const clearSignature = () => {
    setSignature("")
    if (onSignatureChange) {
      onSignatureChange("")
    }
  }



  return (
    <div className="space-y-4">
      {/* Form Fields */}
      <div className="space-y-4">
        {/* Private Key */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-medium text-muted-foreground">
              Private Key (64 hex chars, with or without 0x prefix)
            </label>
            {privateKey && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowPrivateKey(!showPrivateKey)}
                className="text-xs h-6 px-2"
              >
                {showPrivateKey ? (
                  <>
                    <EyeOff className="h-3 w-3 mr-1" />
                    Hide
                  </>
                ) : (
                  <>
                    <Eye className="h-3 w-3 mr-1" />
                    Show
                  </>
                )}
              </Button>
            )}
          </div>
          <input
            type={showPrivateKey ? "text" : "password"}
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            placeholder="Enter your private key..."
            className="w-full p-3 bg-muted rounded-md font-mono text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {privateKey && (
            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              {getKeyStatus()}
            </div>
          )}
        </div>
        
        {/* Message Hex */}
        <MessageHexInput 
          value={messageHex}
          onChange={setMessageHex}
          label="Message Hex"
        />
        

      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          onClick={signWithCustomKey}
          disabled={isLoading || !privateKey.trim()}
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
          onClick={clearSignature}
          disabled={!signature}
        >
          Clear
        </Button>
      </div>

      {/* Signature */}
      <SignatureDisplay 
        signature={signature} 
        showDetails={showSignatureDetails}
        onClose={clearSignature}
      />


    </div>
  )
}
