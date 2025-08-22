import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Shield, 
  Key, 
  MessageSquare, 
  FileCheck, 
  Info
} from "lucide-react"

interface SecurityInfoProps {
  variant: "wallet" | "custom"
}

export function SecurityInfo({ variant }: SecurityInfoProps) {
  const [showDetails, setShowDetails] = useState(false)

  const walletInfo = {
    title: "Secure wallet-based signing",
    color: "green",
    features: [
      {
        icon: Shield,
        title: "Secure Process",
        description: "Private keys never leave your wallet"
      },
      {
        icon: Key,
        title: "Wallet Integration", 
        description: "Uses your connected wallet's signing capabilities"
      },
      {
        icon: MessageSquare,
        title: "Digital Signature",
        description: "Cryptographic proof of message authenticity"
      }
    ]
  }

  const customInfo = {
    title: "Local browser processing",
    color: "blue",
    features: [
      {
        icon: Shield,
        title: "Local Processing",
        description: "No data sent to external servers"
      },
      {
        icon: Key,
        title: "Ed25519 Signing",
        description: "Industry-standard cryptographic algorithm"
      },
      {
        icon: FileCheck,
        title: "Signature Verification",
        description: "Optional comparison with expected result"
      }
    ]
  }

  const info = variant === "wallet" ? walletInfo : customInfo
  const colorClasses = variant === "wallet" 
    ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/20 text-green-800 dark:text-green-200"
    : "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 text-blue-800 dark:text-blue-200"
  
  const iconColorClasses = variant === "wallet"
    ? "text-green-600 dark:text-green-400"
    : "text-blue-600 dark:text-blue-400"

  const buttonColorClasses = variant === "wallet"
    ? "text-green-600 dark:text-green-400"
    : "text-blue-600 dark:text-blue-400"

  return (
    <Card className={`${colorClasses} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Info className={`h-4 w-4 ${iconColorClasses}`} />
            <span>{info.title}</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className={`${buttonColorClasses} h-6 px-2 text-xs`}
          >
            {showDetails ? "Hide" : "Learn More"}
          </Button>
        </div>
        
        {showDetails && (
          <div className={`mt-3 pt-3 border-t space-y-3 text-sm ${
            variant === "wallet" 
              ? "border-green-200 dark:border-green-800" 
              : "border-blue-200 dark:border-blue-800"
          }`}>
            <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-3">
              {info.features.map((feature, index) => {
                const Icon = feature.icon
                return (
                  <div key={index} className="flex items-start gap-2">
                    <Icon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">{feature.title}</p>
                      <p className="text-xs opacity-90">{feature.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
