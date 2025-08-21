import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

interface CustomKeyTesterProps {
  isCollapsible?: boolean
  defaultCollapsed?: boolean
}

export function CustomKeyTester({ isCollapsible = false, defaultCollapsed = false }: CustomKeyTesterProps) {
  const [privateKey, setPrivateKey] = useState("")
  const [messageHex, setMessageHex] = useState("b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb010000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e000220a5a18e45d7086798c4e81cbb9d61cdbd131c74a9f8151ed11f1732c73fc9c718080065cd1d00000000e80300000000000078000000000000006a39ac680000000001")
  const [targetSignature, setTargetSignature] = useState("0xb053f26c923c87e5bf4a37193d57974877286021e19eff05bbf4dcdb54fdef12cc49bfa66e3a0de10781b1068662cb926b719d9c9e08bec633ebeff47c6ad305")
  const [results, setResults] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed)
  const [showPrivateKey, setShowPrivateKey] = useState(false)



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

  const testWithCustomKey = async () => {
    setIsLoading(true)
    setResults([])
    
    try {
      const { Ed25519PrivateKey, Account } = await import("@aptos-labs/ts-sdk")
      
      const log = (message: string) => {
        setResults(prev => [...prev, message])
      }

      log("=== Testing with custom key ===")
      
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
      
      log(`Private key: 0x${privateKeyHex}`)
      log(`Account address: ${account.accountAddress.toString()}`)
      log(`Public key: ${account.publicKey.toString()}`)
      log(`Message: 0x${messageHex}`)
      log(`Signature: ${signature.toString()}`)
      
      // Проверяем подпись
      const isValid = signature.toString() === targetSignature
      log(`Signatures matched: ${isValid}`)
      
      if (isValid) {
        log("✅ SUCCESS: Signature verification passed!")
      } else {
        log("❌ FAILED: Signature verification failed")
      }
      
    } catch (error) {
      console.error("Error with custom key:", error)
      setResults(prev => [...prev, `Error: ${error instanceof Error ? error.message : String(error)}`])
    } finally {
      setIsLoading(false)
    }
  }

  const clearResults = () => {
    setResults([])
  }

  return (
    <Card>
      <CardHeader 
        className={isCollapsible ? "cursor-pointer select-none" : ""}
        onClick={isCollapsible ? () => setIsCollapsed(!isCollapsed) : undefined}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Custom Key Tester</CardTitle>
            <CardDescription>
              Test signing with custom private keys
            </CardDescription>
          </div>
          {isCollapsible && (
            <Button variant="outline" size="icon">
              <ChevronDown 
                className={`h-[1.2rem] w-[1.2rem] transition-transform duration-200 ${
                  isCollapsed ? "rotate-0" : "rotate-180"
                }`}
              />
              <span className="sr-only">Toggle section</span>
            </Button>
          )}
        </div>
      </CardHeader>
      {!isCollapsed && (
        <CardContent className="space-y-4">
        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-muted-foreground">
                Private Key (64 hex chars, with or without 0x prefix)
              </label>
              {privateKey && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPrivateKey(!showPrivateKey)}
                  className="text-xs"
                >
                  {showPrivateKey ? "Hide" : "Show"}
                </Button>
              )}
            </div>
            <div className="relative">
              <input
                type={showPrivateKey ? "text" : "password"}
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
                placeholder="Enter your private key..."
                className="mt-1 w-full p-3 bg-muted rounded-md font-mono text-sm"
              />
            </div>
            {privateKey && (
              <div className="text-xs text-muted-foreground mt-1">
                {getKeyStatus()}
              </div>
            )}
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Message Hex
            </label>
            <textarea
              value={messageHex}
              onChange={(e) => setMessageHex(e.target.value)}
              className="mt-1 w-full p-3 bg-muted rounded-md font-mono text-sm resize-none"
              rows={4}
            />
          </div>
          
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Target Signature
            </label>
            <textarea
              value={targetSignature}
              onChange={(e) => setTargetSignature(e.target.value)}
              className="mt-1 w-full p-3 bg-muted rounded-md font-mono text-sm resize-none"
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <Button 
            onClick={testWithCustomKey}
            disabled={isLoading || !privateKey.trim()}
            className="flex-1"
          >
            {isLoading ? "Testing..." : "Test Signature"}
          </Button>
          <Button 
            variant="outline" 
            onClick={clearResults}
            disabled={results.length === 0}
          >
            Clear Results
          </Button>
        </div>

        {results.length > 0 && (
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Results
            </label>
            <div className="mt-1 p-3 bg-muted rounded-md font-mono text-sm overflow-y-auto">
              {results.map((result, index) => (
                <div key={index} className="mb-1">
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}
        </CardContent>
      )}
    </Card>
  )
}
