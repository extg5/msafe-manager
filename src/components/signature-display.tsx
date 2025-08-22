import { Signature } from "lucide-react"
import { Hex } from "@aptos-labs/ts-sdk"
import { useMemo } from "react"
import { ResultPanel } from "./result-panel"
import { CopyButton } from "./ui/copy-button"

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
      icon={Signature}
      variant="info"
      onClose={onClose}
      // headerActions={formatToggle}
    >
      {showDetails && (
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium text-muted-foreground mb-2 block">
              Signature (Hex)
            </label>
            <div className="relative">
              <div className="p-3 pr-12 bg-background rounded-md font-mono text-sm break-all border">
                {signature}
              </div>
              <CopyButton
                textToCopy={signature}
                className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-muted"
              />
            </div>
          </div>
          
          {signatureBytes && (
            <div>
              <label className="text-sm font-medium text-muted-foreground mb-2 block">
                Signature Bytes ({signatureBytes.length} bytes)
              </label>
              <div className="relative">
                <div className="p-3 pr-12 bg-background rounded-md font-mono text-xs break-all border max-h-32 overflow-y-auto">
                  [{signatureBytes.join(', ')}]
                </div>
                <CopyButton
                  textToCopy={`[${signatureBytes.join(', ')}]`}
                  className="absolute top-2 right-2 h-6 w-6 p-0 hover:bg-muted"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </ResultPanel>
  )
}
