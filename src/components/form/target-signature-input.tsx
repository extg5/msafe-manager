import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/ui/form-field"

interface TargetSignatureInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  rows?: number
  required?: boolean
  className?: string
}

export function TargetSignatureInput({
  value,
  onChange,
  label = "Target Signature",
  placeholder = "Enter expected signature for verification...",
  rows = 2,
  required = false,
  className
}: TargetSignatureInputProps) {
  return (
    <FormField 
      label={label}
      description="The signature you want to verify against"
      required={required}
      className={className}
    >
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="font-mono text-sm"
      />
    </FormField>
  )
}
