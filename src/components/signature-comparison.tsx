import { useState, useEffect } from "react"
import { GitCompare } from "lucide-react"
import { ResultPanel } from "./result-panel"
import { TargetSignatureInput } from "@/components/form"
import { FormField } from "@/components/ui/form-field"
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface SignatureComparisonProps {
  selectedSignature?: "wallet" | "custom" | null
  walletSignature?: string
  customSignature?: string
  onComparisonChange?: (result: {
    isMatch: boolean
    selectedSig: string
    selectedType: string
  } | null) => void
  onChangeSelectedSignature?: (s: "wallet" | "custom" | null) => void
}

export function SignatureComparison({ 
  selectedSignature,
  walletSignature, 
  customSignature,
  onComparisonChange,
  onChangeSelectedSignature = () => {},
}: SignatureComparisonProps) {
  const [targetSignature, setTargetSignature] = useState("0xb053f26c923c87e5bf4a37193d57974877286021e19eff05bbf4dcdb54fdef12cc49bfa66e3a0de10781b1068662cb926b719d9c9e08bec633ebeff47c6ad305")
  const [comparisonResult, setComparisonResult] = useState<{
    isMatch: boolean
    selectedSig: string
    selectedType: string
  } | null>(null)

  // Compare selected signature with target
  useEffect(() => {
    const wallet = walletSignature?.trim()
    const custom = customSignature?.trim()
    const target = targetSignature?.trim()

    // Compare selected signature with target
    if (target && selectedSignature) {
      const selectedSig = selectedSignature === "wallet" ? wallet : custom
      if (selectedSig) {
        const isMatch = selectedSig === target
        const result = {
          isMatch,
          selectedSig,
          selectedType: selectedSignature === "wallet" ? "Wallet Signature" : "Custom Key Signature"
        }
        setComparisonResult(result)
        onComparisonChange?.(result)
      } else {
        setComparisonResult(null)
        onComparisonChange?.(null)
      }
    } else {
      setComparisonResult(null)
      onComparisonChange?.(null)
    }
  }, [walletSignature, customSignature, selectedSignature, targetSignature, onComparisonChange])

  // Always show component when it's visible, but show all options
  const allSignatureOptions = [
    { value: "wallet", label: "Wallet Signature", available: !!walletSignature },
    { value: "custom", label: "Custom Key Signature", available: !!customSignature }
  ]

  const hasTargetSignature = targetSignature?.trim()

  return (
    <ResultPanel
      title="Signature Comparison"
      icon={GitCompare}
      variant={comparisonResult ? (comparisonResult.isMatch ? "success" : "error") : "info"}
    >
      <div className="space-y-4">
        <TargetSignatureInput
          value={targetSignature}
          onChange={setTargetSignature}
          label="Target Signature (for verification)"
        />

        <FormField label="Select Signature to Compare with Target">
          <Select 
            value={selectedSignature || ""} 
            onValueChange={(value: "wallet" | "custom") => onChangeSelectedSignature(value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select signature to compare" />
            </SelectTrigger>
            <SelectContent>
              {allSignatureOptions.map((sig) => (
                <SelectItem 
                  key={sig.value} 
                  value={sig.value}
                  disabled={!sig.available}
                >
                  {sig.label} {!sig.available && "(Not available)"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        {selectedSignature && (
          <FormField 
            label={`${selectedSignature === "wallet" ? "Wallet Signature" : "Custom Key Signature"} (Selected)`}
          >
            <div className="p-3 bg-background rounded-md font-mono text-sm break-all border">
              {selectedSignature === "wallet" ? walletSignature : customSignature}
            </div>
          </FormField>
        )}



        {!hasTargetSignature && (
          <div className="p-4 bg-muted rounded-md border">
            <div className="text-sm text-muted-foreground">
              Enter a target signature to enable comparison
            </div>
          </div>
        )}

        {hasTargetSignature && !selectedSignature && (
          <div className="p-4 bg-muted rounded-md border">
            <div className="text-sm text-muted-foreground">
              Generate a signature from wallet or custom key to compare with target
            </div>
          </div>
        )}
      </div>
    </ResultPanel>
  )
}
