import { useState, useEffect } from "react"

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
  label = "Message Hex (hex string with or without 0x prefix)",
  className = "",
  required = false
}: MessageHexInputProps) {
  const [status, setStatus] = useState("")

  const getMessageStatus = (messageHex: string) => {
    if (!messageHex.trim()) return ""
    
    let cleanHex = messageHex.trim()
    if (cleanHex.startsWith('0x')) {
      cleanHex = cleanHex.slice(2)
    }
    
    // Check if it's valid hex
    if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
      return "⚠ Invalid hex format"
    }
    
    if (cleanHex.length === 0) {
      return "⚠ Empty message"
    }
    
    if (cleanHex.length % 2 !== 0) {
      return "⚠ Odd hex string length"
    }
    
    return `✓ Hex message: ${Math.floor(cleanHex.length / 2)} bytes`
  }

  useEffect(() => {
    setStatus(getMessageStatus(value))
  }, [value])

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="text-sm font-medium text-muted-foreground">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full p-3 bg-muted rounded-md font-mono text-sm resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        rows={rows}
        required={required}
      />
      {value && status && (
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {status}
        </div>
      )}
    </div>
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
