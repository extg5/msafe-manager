import React, { type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { X } from "lucide-react"
import { type LucideProps } from "lucide-react"

interface ResultPanelProps {
  title: string
  icon: React.ComponentType<LucideProps>
  variant: "success" | "error" | "info"
  children: ReactNode
  className?: string
  onClose?: () => void
  headerActions?: ReactNode
}

export function ResultPanel({
  title,
  icon: Icon,
  variant,
  children,
  className = "",
  onClose,
  headerActions
}: ResultPanelProps) {
  const getVariantClasses = () => {
    switch (variant) {
      case "success":
        return {
          container: "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20",
          text: "text-green-800 dark:text-green-200"
        }
      case "error":
        return {
          container: "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20",
          text: "text-red-800 dark:text-red-200"
        }
      case "info":
      default:
        return {
          container: "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20",
          text: "text-blue-800 dark:text-blue-200"
        }
    }
  }

  const variantClasses = getVariantClasses()

  return (
    <div className={`space-y-3 rounded-lg border p-4 ${variantClasses.container} ${className}`}>
      <div className={`flex items-center justify-between ${variantClasses.text} mb-3`}>
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="font-medium">{title}</span>
          {headerActions && (
            <div className="ml-3">
              {headerActions}
            </div>
          )}
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0 hover:bg-transparent"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
      
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}
