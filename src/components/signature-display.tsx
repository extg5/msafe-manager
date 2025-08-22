import { CheckCircle, ChevronDown } from "lucide-react"
import { Hex } from "@aptos-labs/ts-sdk"
import { Button } from "@/components/ui/button"
import { useMemo } from "react"

interface SignatureDisplayProps {
  signature: string
  showDetails?: boolean
  onToggleDetails?: () => void
}

export function SignatureDisplay({ signature, showDetails = true, onToggleDetails }: SignatureDisplayProps) {
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
    <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 p-4">
      <div className="flex items-center justify-between text-blue-800 dark:text-blue-200 mb-3">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          <span className="font-medium">Signature Generated</span>
        </div>
        {onToggleDetails && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleDetails}
            className="h-6 w-6 p-0 hover:bg-transparent"
          >
            <ChevronDown 
              className={`h-4 w-4 transition-transform duration-200 ${
                showDetails ? "scale-100" : "-scale-100"
              }`}
            />
          </Button>
        )}
      </div>
      
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
    </div>
  )
}
