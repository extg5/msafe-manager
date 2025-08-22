import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Eye, EyeOff, CheckCircle, FileCheck, AlertCircle, X, ChevronDown } from "lucide-react"
import { SignatureDisplay } from "./signature-display"

export function CustomKeySigner() {
  const [privateKey, setPrivateKey] = useState("")
  const [messageHex, setMessageHex] = useState("b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb010000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e000220a5a18e45d7086798c4e81cbb9d61cdbd131c74a9f8151ed11f1732c73fc9c718080065cd1d00000000e80300000000000078000000000000006a39ac680000000001")
  const [targetSignature, setTargetSignature] = useState("0xb053f26c923c87e5bf4a37193d57974877286021e19eff05bbf4dcdb54fdef12cc49bfa66e3a0de10781b1068662cb926b719d9c9e08bec633ebeff47c6ad305")
  const [results, setResults] = useState<string[]>([])
  const [signature, setSignature] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [showPrivateKey, setShowPrivateKey] = useState(false)
  const [isSuccess, setIsSuccess] = useState<boolean | null>(null)
  const [showSignatureDetails, setShowSignatureDetails] = useState(true)
  const [showResultsDetails, setShowResultsDetails] = useState(true)



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
    setResults([])
    setSignature("")
    setIsSuccess(null)
    
    try {
      const { Ed25519PrivateKey, Account } = await import("@aptos-labs/ts-sdk")
      
      const log = (message: string) => {
        setResults(prev => [...prev, message])
      }

      log("=== Signing with custom key ===")
      
      if (!privateKey.trim()) {
        log("Private key is required")
        return
      }
      
      let privateKeyHex = privateKey.trim()
      
      // Убираем 0x префикс если он есть
      if (privateKeyHex.startsWith('0x')) {
        privateKeyHex = privateKeyHex.slice(2)
      }
      
      // Проверяем длину ключа
      if (privateKeyHex.length !== 64) {
        throw new Error(`Private key must be exactly 64 hex characters (32 bytes), got ${privateKeyHex.length}`)
      }
      
      const privateKeyObj = new Ed25519PrivateKey(`0x${privateKeyHex}`)
      const account = Account.fromPrivateKey({ privateKey: privateKeyObj })
      
      const signature = account.sign(`0x${messageHex}`)
      const signatureStr = signature.toString()
      
      // Сохраняем сигнатуру в состоянии
      setSignature(signatureStr)
      
      log(`Private key: 0x${privateKeyHex}`)
      log(`Account address: ${account.accountAddress.toString()}`)
      log(`Public key: ${account.publicKey.toString()}`)
      log(`Message: 0x${messageHex}`)
      log(`Signature: ${signatureStr}`)
      
      // Проверяем подпись
      const isValid = signatureStr === targetSignature
      log(`Signatures matched: ${isValid}`)
      
      if (isValid) {
        log("✅ SUCCESS: Signature verification passed!")
        setIsSuccess(true)
      } else {
        log("❌ FAILED: Signature verification failed")
        setIsSuccess(false)
      }
      
    } catch (error) {
      console.error("Error with custom key:", error)
      setResults(prev => [...prev, `Error: ${error instanceof Error ? error.message : String(error)}`])
      setIsSuccess(false)
    } finally {
      setIsLoading(false)
    }
  }

  const clearResults = () => {
    setResults([])
    setSignature("")
    setIsSuccess(null)
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
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Message Hex
          </label>
          <textarea
            value={messageHex}
            onChange={(e) => setMessageHex(e.target.value)}
            placeholder="Enter hex message to sign..."
            className="mt-1 w-full p-3 bg-muted rounded-md font-mono text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            rows={4}
          />
        </div>
        
        {/* Target Signature */}
        <div>
          <label className="text-sm font-medium text-muted-foreground">
            Target Signature (optional, for verification)
          </label>
          <textarea
            value={targetSignature}
            onChange={(e) => setTargetSignature(e.target.value)}
            placeholder="Enter expected signature for verification..."
            className="mt-1 w-full p-3 bg-muted rounded-md font-mono text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            rows={2}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button 
          onClick={signWithCustomKey}
          disabled={isLoading || !privateKey.trim()}
          className="w-full"
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
      </div>

      {/* Signature */}
      <SignatureDisplay 
        signature={signature} 
        showDetails={showSignatureDetails}
        onToggleDetails={() => setShowSignatureDetails(!showSignatureDetails)}
      />

      {/* Results */}
      {results.length > 0 && (
        <div className={`rounded-lg border p-4 ${
          isSuccess === true 
            ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20" 
            : isSuccess === false 
            ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20" 
            : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20"
        }`}>
          <div className={`flex items-center justify-between mb-3 ${
            isSuccess === true 
              ? "text-green-800 dark:text-green-200" 
              : isSuccess === false 
              ? "text-red-800 dark:text-red-200" 
              : "text-blue-800 dark:text-blue-200"
          }`}>
            <div className="flex items-center gap-2">
              {isSuccess === true ? (
                <CheckCircle className="h-4 w-4" />
              ) : isSuccess === false ? (
                <AlertCircle className="h-4 w-4" />
              ) : (
                <FileCheck className="h-4 w-4" />
              )}
              <span className="font-medium">
                {isSuccess === true ? "Signature Verification: Success" : isSuccess === false ? "Signature Verification: Failed" : "Processing Results"}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResultsDetails(!showResultsDetails)}
                className="h-6 w-6 p-0 hover:bg-transparent"
              >
                <ChevronDown 
                  className={`h-4 w-4 transition-transform duration-200 ${
                    showResultsDetails ? "scale-100" : "-scale-100"
                  }`}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearResults}
                className="h-6 w-6 p-0 hover:bg-transparent"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {showResultsDetails && (
            <div className="p-3 bg-background rounded-md font-mono text-sm overflow-y-auto max-h-64 border">
              {results.map((result, index) => (
                <div key={index} className="mb-1 text-xs">
                  {result}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
