import { AptosWalletAdapterProvider } from "@aptos-labs/wallet-adapter-react"
import { Network } from "@aptos-labs/ts-sdk"

export function WalletProvider({ children }: { children: React.ReactNode }) {
  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={{ 
        network: Network.MAINNET,
        // You can add aptosApiKey here if you have one
        // aptosApiKey: "your-api-key"
      }}
      onError={(error) => {
        console.error("Wallet connection error:", error)
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  )
}
