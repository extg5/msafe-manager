import { AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorDisplayProps {
  error: string
  onClear?: () => void
  className?: string
}

export function ErrorDisplay({ error, onClear, className = "" }: ErrorDisplayProps) {
  if (!error) return null

  return (
    <div className={`rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20 p-3 ${className}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm text-red-800 dark:text-red-200 min-w-0">
            <strong>Error:</strong> {error}
          </div>
        </div>
        {onClear && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-6 w-6 p-0 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/20 shrink-0"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  )
}
