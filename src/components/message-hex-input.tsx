import { HexInput } from "@/components/form"

interface MessageHexInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  label?: string
  className?: string
  required?: boolean
}

export function MessageHexInput({
  value,
  onChange,
  placeholder = "Enter hex message to sign...",
  rows = 4,
  label = "Message Hex",
  className = "",
  required = false
}: MessageHexInputProps) {
  return (
    <HexInput
      value={value}
      onChange={onChange}
      label={label}
      placeholder={placeholder}
      rows={rows}
      required={required}
      className={className}
    />
  )
}
