import { Link } from "react-router-dom"
import { Header } from "@/components/header"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  TestTube, 
  Shield, 
  Wallet, 
  GitCompare,
  ArrowRight
} from "lucide-react"

export function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-4">
            <h1 className="text-4xl font-bold tracking-tight">
              Aptos Signer
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Comprehensive tool for message signing, signature comparison, and MSafe multisig wallet management on Aptos
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500 rounded-lg">
                  <TestTube className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">Sandbox</h3>
              </div>
              <p className="text-muted-foreground">
                Interactive testing environment for message signing, signature comparison, and wallet management
              </p>
              <Button asChild className="w-full">
                <Link to="/sandbox">
                  Open Sandbox
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </Card>

            <Card className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500 rounded-lg">
                  <Shield className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-xl font-semibold">MSafe Integration</h3>
              </div>
              <p className="text-muted-foreground">
                Check MSafe multisig wallet registration status and manage your multisig wallets
              </p>
              <Button asChild variant="outline" className="w-full">
                <Link to="/sandbox">
                  View MSafe Tools
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </Card>
          </div>

          {/* Features List */}
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-center">Features</h2>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center space-y-2">
                <div className="mx-auto p-3 bg-blue-100 dark:bg-blue-900 rounded-full w-fit">
                  <Wallet className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-medium">Wallet Signing</h3>
                <p className="text-sm text-muted-foreground">
                  Sign messages using connected Aptos wallets
                </p>
              </div>
              
              <div className="text-center space-y-2">
                <div className="mx-auto p-3 bg-neutral-100 dark:bg-neutral-800 rounded-full w-fit">
                  <GitCompare className="h-6 w-6 text-neutral-600 dark:text-neutral-400" />
                </div>
                <h3 className="font-medium">Signature Comparison</h3>
                <p className="text-sm text-muted-foreground">
                  Compare signatures from different sources
                </p>
              </div>
              
              <div className="text-center space-y-2">
                <div className="mx-auto p-3 bg-purple-100 dark:bg-purple-900 rounded-full w-fit">
                  <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="font-medium">MSafe Support</h3>
                <p className="text-sm text-muted-foreground">
                  Multisig wallet management and verification
                </p>
              </div>
            </div>
          </div>

          {/* Quick Start */}
          <Card className="p-6 bg-muted/50">
            <div className="text-center space-y-4">
              <h3 className="text-lg font-semibold">Ready to get started?</h3>
              <p className="text-muted-foreground">
                Jump into the sandbox to start testing message signing and signature comparison
              </p>
              <Button asChild size="lg">
                <Link to="/sandbox">
                  Go to Sandbox
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
