import { useState } from "react"
import { Button, buttonVariants } from "./button"
import { Copy, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { type VariantProps } from "class-variance-authority"
import * as React from "react"

interface CopyButtonProps extends Omit<React.ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }, 'onClick'> {
  textToCopy: string
  onCopy?: () => void
  showFeedback?: boolean
  feedbackDuration?: number
}

export function CopyButton({
  textToCopy,
  onCopy,
  showFeedback = true,
  feedbackDuration = 2000,
  className,
  size = "sm",
  variant = "ghost",
  children,
  ...props
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy)
      onCopy?.()
      
      if (showFeedback) {
        setCopied(true)
        setTimeout(() => setCopied(false), feedbackDuration)
      }
    } catch (err) {
      console.error('Failed to copy: ', err)
    }
  }

  return (
    <Button
      size={size}
      variant={variant}
      onClick={handleCopy}
      className={cn("shrink-0", className)}
      {...props}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {children}
    </Button>
  )
}
