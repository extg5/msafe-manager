import * as React from "react"
import { Button, buttonVariants } from "./button"
import { Loader2 } from "lucide-react"
import { type VariantProps } from "class-variance-authority"

export function LoadingButton({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    loadingText?: string
  }) {
  return (
    <Button
      className={className}
      variant={variant}
      size={size}
      asChild={asChild}
      disabled={loading || disabled}
      {...props}
    >
      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
      {loading ? (loadingText || children) : children}
    </Button>
  )
}
