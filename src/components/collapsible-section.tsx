import React, { type ReactNode } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { type LucideProps } from "lucide-react"

interface CollapsibleSectionProps {
  title: ReactNode
  description: string
  icon: React.ComponentType<LucideProps>
  iconColor: string
  isExpanded: boolean
  onToggle: () => void
  children: ReactNode
  className?: string
  disabled?: boolean
}

export function CollapsibleSection({
  title,
  description,
  icon: Icon,
  iconColor,
  isExpanded,
  onToggle,
  children,
  className = "",
  disabled = false
}: CollapsibleSectionProps) {
  return (
    <Card 
      className={`cursor-pointer hover:bg-muted/50 transition-colors ${className} ${
        disabled ? "opacity-50 cursor-not-allowed" : ""
      }`}
      onClick={disabled ? undefined : onToggle}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={`p-2 ${iconColor} rounded-lg shrink-0`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-lg">
                {title}
              </CardTitle>
              <CardDescription className="mt-1">
                {description}
              </CardDescription>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 shrink-0 m-auto bg-accent dark:bg-accent/40"
            onClick={(e) => {
              e.stopPropagation()
              if (!disabled) {
                onToggle()
              }
            }}
            disabled={disabled}
          >
            <ChevronDown 
              className={`h-4 w-4 transition-transform duration-200 ${
                isExpanded ? "scale-100" : "-scale-100"
              }`}
            />
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent onClick={(e) => e.stopPropagation()}>
          {children}
        </CardContent>
      )}
    </Card>
  )
}
