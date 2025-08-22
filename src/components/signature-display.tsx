import { Signature, Copy, Check, Hash, Binary, ToggleLeft } from "lucide-react"
import { Hex } from "@aptos-labs/ts-sdk"
import { useMemo, useState } from "react"
import { ResultPanel } from "./result-panel"
import { Button } from "./ui/button"

interface SignatureDisplayProps {
  signature: string
  showDetails?: boolean
  onClose?: () => void
}

type DisplayFormat = "hex" | "bytes" | "both"

export function SignatureDisplay({ 
  signature, 
  showDetails = true,
  onClose
}: SignatureDisplayProps) {
  const [displayFormat, setDisplayFormat] = useState<DisplayFormat>("hex")
  const [copiedHex, setCopiedHex] = useState(false)
  const [copiedBytes, setCopiedBytes] = useState(false)

  const signatureBytes = useMemo(() => {
    if (!signature) return null
    try {
      const uint8Array = Hex.hexInputToUint8Array(signature)
      return Array.from(uint8Array)
    } catch {
      return null
    }
  }, [signature])

  const copyToClipboard = async (text: string, type: 'hex' | 'bytes') => {
    try {
      await navigator.clipboard.writeText(text)
      if (type === 'hex') {
        setCopiedHex(true)
        setTimeout(() => setCopiedHex(false), 2000)
      } else {
        setCopiedBytes(true)
        setTimeout(() => setCopiedBytes(false), 2000)
      }
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const formatToggle = (
    <div className="flex items-center gap-1 bg-muted rounded-md p-1">
      <Button
        size="sm"
        variant={displayFormat === "hex" ? "default" : "ghost"}
        onClick={() => setDisplayFormat("hex")}
        className="h-6 px-2 text-xs"
      >
        <Hash className="h-3 w-3 mr-1" />
        Hex
      </Button>
      <Button
        size="sm"
        variant={displayFormat === "bytes" ? "default" : "ghost"}
        onClick={() => setDisplayFormat("bytes")}
        className="h-6 px-2 text-xs"
      >
        <Binary className="h-3 w-3 mr-1" />
        Bytes
      </Button>
      <Button
        size="sm"
        variant={displayFormat === "both" ? "default" : "ghost"}
        onClick={() => setDisplayFormat("both")}
        className="h-6 px-2 text-xs"
      >
        <ToggleLeft className="h-3 w-3 mr-1" />
        Both
      </Button>
    </div>
  )

  if (!signature) return null

  return (
    <ResultPanel
      title="Signature Generated"
      icon={Signature}
      variant="info"
      onClose={onClose}
      // headerActions={formatToggle}
    >
      {showDetails && (
        <div className="flex flex-col gap-4">
          {(displayFormat === "hex" || displayFormat === "both") && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Signature (Hex)
              </label>
              <div className="relative">
                <div className="p-3 pr-12 bg-background rounded-md font-mono text-sm break-all border">
                  {signature}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(signature, 'hex')}
                  className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-muted"
                >
                  {copiedHex ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          )}
          
          {signatureBytes && (displayFormat === "bytes" || displayFormat === "both") && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Signature Bytes ({signatureBytes.length} bytes)
              </label>
              <div className="relative">
                <div className="p-3 pr-12 bg-background rounded-md font-mono text-xs break-all border max-h-32 overflow-y-auto">
                  [{signatureBytes.join(', ')}]
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => copyToClipboard(`[${signatureBytes.join(', ')}]`, 'bytes')}
                  className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-muted"
                >
                  {copiedBytes ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </ResultPanel>
  )
}
