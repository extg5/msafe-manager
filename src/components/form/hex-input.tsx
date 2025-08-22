import { useState, useEffect } from "react"
import { Textarea } from "@/components/ui/textarea"
import { FormField } from "@/components/ui/form-field"
import { StatusIndicator } from "@/components/ui/status-indicator"

interface HexInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  rows?: number
  required?: boolean
  className?: string
}

export function HexInput({
  value,
  onChange,
  label = "Hex Input",
  placeholder = "Enter hex string with or without 0x prefix...",
  rows = 4,
  required = false,
  className
}: HexInputProps) {
  const [status, setStatus] = useState<{
    type: "success" | "warning" | "info"
    message: string
  } | null>(null)

  const validateHex = (hex: string) => {
    if (!hex.trim()) {
      return null
    }
    
    let cleanHex = hex.trim()
    if (cleanHex.startsWith('0x')) {
      cleanHex = cleanHex.slice(2)
    }
    
    // Check if it's valid hex
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      return { type: "warning" as const, message: "Invalid hex format" }
    }
    
    if (cleanHex.length === 0) {
      return { type: "warning" as const, message: "Empty input" }
    }
    
    if (cleanHex.length % 2 !== 0) {
      return { type: "warning" as const, message: "Hex string must have even length" }
    }
    
    return { 
      type: "success" as const, 
      message: `Valid hex: ${Math.floor(cleanHex.length / 2)} bytes` 
    }
  }

  useEffect(() => {
    setStatus(validateHex(value))
  }, [value])

  return (
    <FormField 
      label={label}
      required={required}
      className={className}
    >
      <div className="space-y-2">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="font-mono text-sm"
        />
        {status && (
          <StatusIndicator 
            type={status.type}
            message={status.message}
          />
        )}
      </div>
    </FormField>
  )
}

// Utility functions for working with hex
// eslint-disable-next-line react-refresh/only-export-components
export const hexUtils = {
  cleanHex: (hex: string): string => {
    let cleanHex = hex.trim()
    if (cleanHex.startsWith('0x')) {
      cleanHex = cleanHex.slice(2)
    }
    return cleanHex
  },

  isValidHex: (hex: string): boolean => {
    const clean = hexUtils.cleanHex(hex)
    return /^[0-9a-fA-F]*$/.test(clean) && clean.length > 0 && clean.length % 2 === 0
  },

  validateHex: (hex: string): { isValid: boolean; error?: string } => {
    const clean = hexUtils.cleanHex(hex)
    
    if (clean.length === 0) {
      return { isValid: false, error: "Empty message" }
    }
    
    if (!/^[0-9a-fA-F]*$/.test(clean)) {
      return { isValid: false, error: "Invalid hex format" }
    }
    
    if (clean.length % 2 !== 0) {
      return { isValid: false, error: "Hex string must have even length" }
    }
    
    return { isValid: true }
  }
}
