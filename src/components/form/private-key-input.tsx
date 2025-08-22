import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { StatusIndicator } from "@/components/ui/status-indicator"
import { Eye, EyeOff } from "lucide-react"

interface PrivateKeyInputProps {
  value: string
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  required?: boolean
  className?: string
}

export function PrivateKeyInput({
  value,
  onChange,
  label = "Private Key",
  placeholder = "Enter your private key...",
  required = false,
  className
}: PrivateKeyInputProps) {
  const [showKey, setShowKey] = useState(false)

  const getKeyStatus = () => {
    if (!value.trim()) return null
    
    let cleanKey = value.trim()
    if (cleanKey.startsWith('0x')) {
      cleanKey = cleanKey.slice(2)
    }
    
    if (cleanKey.length === 64) {
      return {
        type: "success" as const,
        message: `Valid key: ${cleanKey.slice(0, 4)}...${cleanKey.slice(-4)}`
      }
    } else {
      return {
        type: "warning" as const,
        message: `Invalid key length: ${cleanKey.length}/64 chars`
      }
    }
  }

  const status = getKeyStatus()

  const handleClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.currentTarget.select()
  }

  return (
    <FormField 
      label={label}
      description={
        status ? (
          <StatusIndicator 
            type={status.type}
            message={status.message}
          />
        ) : (
          "64 hex characters, with or without 0x prefix"
        )
      }
      required={required}
      className={className}
    >
      <div className="relative">
        <Input
          type={showKey ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={handleClick}
          placeholder={placeholder}
          className="font-mono text-sm pr-12"
        />
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
          >
            {showKey ? (
              <EyeOff className="h-3 w-3" />
            ) : (
              <Eye className="h-3 w-3" />
            )}
          </Button>
        )}
      </div>
    </FormField>
  )
}
