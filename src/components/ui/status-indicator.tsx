import { cn } from "@/lib/utils"
import { CheckCircle, AlertCircle, Info } from "lucide-react"

interface StatusIndicatorProps {
  type: "success" | "warning" | "info" | "default"
  message: string
  className?: string
}

export function StatusIndicator({ type, message, className }: StatusIndicatorProps) {
  const getVariantStyles = () => {
    switch (type) {
      case "success":
        return {
          container: "text-green-600 dark:text-green-400",
          icon: CheckCircle
        }
      case "warning":
        return {
          container: "text-yellow-600 dark:text-yellow-400",
          icon: AlertCircle
        }
      case "info":
        return {
          container: "text-blue-600 dark:text-blue-400",
          icon: Info
        }
      default:
        return {
          container: "text-muted-foreground",
          icon: Info
        }
    }
  }

  const variant = getVariantStyles()
  const Icon = variant.icon

  return (
    <div className={cn("flex items-center gap-1 text-xs", variant.container, className)}>
      <Icon className="h-3 w-3" />
      <span>{message}</span>
    </div>
  )
}
