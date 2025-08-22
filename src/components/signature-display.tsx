import { CheckCircle } from "lucide-react"
import { Hex } from "@aptos-labs/ts-sdk"
import { useMemo } from "react"
import { ResultPanel } from "./result-panel"

interface SignatureDisplayProps {
  signature: string
  showDetails?: boolean
  onClose?: () => void
}

export function SignatureDisplay({ 
  signature, 
  showDetails = true,
  onClose
}: SignatureDisplayProps) {
  const signatureBytes = useMemo(() => {
    if (!signature) return null
    try {
      const uint8Array = Hex.hexInputToUint8Array(signature)
      return Array.from(uint8Array)
    } catch {
      return null
    }
  }, [signature])

  if (!signature) return null

  return (
    <ResultPanel
      title="Signature Generated"
      icon={CheckCircle}
      variant="info"
      onClose={onClose}
    >
      {showDetails && (
        <>
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Signature (Hex)
            </label>
            <div className="mt-1 p-3 bg-background rounded-md font-mono text-sm break-all border">
              {signature}
            </div>
          </div>
          
          {signatureBytes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground">
                Signature Bytes ({signatureBytes.length} bytes)
              </label>
              <div className="mt-1 p-3 bg-background rounded-md font-mono text-xs break-all border max-h-32 overflow-y-auto">
                [{signatureBytes.join(', ')}]
              </div>
            </div>
          )}
        </>
      )}
    </ResultPanel>
  )
}
