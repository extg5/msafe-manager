import { useState, useEffect } from "react"
import { useWallet } from "@aptos-labs/wallet-adapter-react"
import { Hex, Serializer, hexToAsciiString } from "@aptos-labs/ts-sdk"
import { BCS, TransactionBuilder, TxnBuilderTypes } from "aptos"
import { Deserializer, SignedTransaction, TransactionAuthenticatorEd25519 } from "@aptos-labs/ts-sdk"
import { WalletConnectors, type WalletType, RPCClient } from "msafe-wallet-adaptor";

// Pontem Provider interface
interface PontemProvider {
  signTransaction(payload: unknown, opts: unknown): Promise<Uint8Array | { result: Uint8Array }>
  signAndSubmit(payload: unknown, opts: unknown): Promise<Uint8Array | { result: Uint8Array }>
  switchNetwork?(chainId: string): Promise<void>
}

import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { WalletModal } from "./wallet-modal"
import { SignatureDisplay } from "./signature-display"
import { ErrorDisplay } from "./error-display"
import { MSafeAccountSelector } from "./msafe-account-selector"
import { toHex } from "@/utils/signature"

// MSafe deployer address for Mainnet from the official documentation
// https://doc.m-safe.io/aptos/developers/system/msafe-contracts#deployed-smart-contract
const MSAFE_MODULES_ACCOUNT = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e"

interface ProviderCheckerProps {
  onSignatureChange?: (signature: string) => void
}

export function ProviderChecker({ onSignatureChange }: ProviderCheckerProps) {
  // Default transaction payload for testing
  const defaultPayload = JSON.stringify({
    "function": "0x1::coin::transfer",
    "type_arguments": ["0x0000000000000000000000000000000000000000000000000000000000000001::aptos_coin::AptosCoin"],
    "arguments": ["0x3311cd72df40ff27ba05d3ad80f8d72334d24b7fcafc284e52acf244580236d4", "100000"]
  }, null, 2)

  const [payload, setPayload] = useState(defaultPayload)
  const [signature, setSignature] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false)
  const [selectedMSafeAccount, setSelectedMSafeAccount] = useState<string>("")

  const { connected, account, wallet } = useWallet()

  useEffect(() => {
    console.log('Provider Checker - account:', account)
    console.log('Provider Checker - wallet:', wallet)
    // @ts-expect-error test
    console.log('Provider Checker - wallet.signTransaction:', wallet?.signTransaction)
  }, [account, wallet])

  const signTransactionWithWallet = async () => {
    if (!connected || !account) {
      setError("Wallet not connected")
      return
    }

    if (!payload.trim()) {
      setError("Enter transaction payload")
      return
    }

    setIsLoading(true)
    setError("")
    setSignature("")

    try {
      // Parse the JSON payload
      let parsedPayload
      try {
        parsedPayload = JSON.parse(payload)
      } catch (parseError) {
        throw new Error("Invalid JSON payload")
      }

      // Now submit the init_transaction to MSafe
      if (!selectedMSafeAccount) {
        throw new Error("MSafe account must be selected for init_transaction")
      }

      // Use Pontem provider for transaction signing with proper configuration
      const provider = (window as { pontem?: PontemProvider }).pontem
      if (!provider) throw new Error("Pontem provider not found on window")
      
      try { 
        await provider.switchNetwork?.("1") // mainnet
      } catch {
        console.log("Network switch not needed or failed")
      }

      // Use the parsed payload directly (should already have function, type_arguments, arguments)
      const transactionPayload = parsedPayload

      // Use MSafe account as sender if selected, otherwise use wallet account
      const senderAddress = selectedMSafeAccount

      // const msafeAccount = await WalletConnectors['Pontem']();

      // console.log('msafeAccount', msafeAccount)
      
      // Transaction options - using some defaults
      const opts = {
        // type: 'entry_function_payload',
        sender: senderAddress,
        sequence_number: "0", // Will be filled by provider
        max_gas_amount: "100000",
        gas_unit_price: "100",
        expiration_timestamp_secs: Math.floor(Date.now() / 1000) + 600, // 10 minutes from now
      }

      console.log('Transaction payload:', transactionPayload)
      console.log('Transaction opts:', opts)

      // Sign only (no submit)
      const ret = await provider.signTransaction(transactionPayload, opts)
      console.log('Provider response:', ret)

      
      const signedBytes = ret instanceof Uint8Array ? ret : ret.result
      // const deserializer = new Deserializer(signedBytes)
      const deserializer = new BCS.Deserializer(signedBytes);
      const signedTx = TxnBuilderTypes.SignedTransaction.deserialize(deserializer);

      // console.log('signedBytes', toHex(signedBytes))
      console.log('Signed transaction:', signedTx)

      const authenticator =
        signedTx.authenticator as TxnBuilderTypes.TransactionAuthenticatorEd25519;
      const signingMessage = TransactionBuilder.getSigningMessage(signedTx.raw_txn);
      const sig = authenticator.signature;

      console.log('signingMessage1', toHex(signingMessage))
      console.log('signature1', sig)

      const pkIndex = 0


      const submitPayload = {
        function: `${MSAFE_MODULES_ACCOUNT}::momentum_safe::init_transaction`,
        type_arguments: [],
        arguments: [
          selectedMSafeAccount,           // MSafe address
          `${pkIndex}`,                       // Public key index (u8)
          BCS.bcsSerializeBytes(signingMessage),    // Signing message (bytes)
          BCS.bcsToBytes(sig),         // Signature (bytes)
        ]
      }

      console.log('Submit payload for init_transaction:', submitPayload)


      const submitOpts = {
        // Should be owner address I think, not msafe address
        // sender: account.address.toString(),
        sequence_number: 0, // Will be filled by the provider
        max_gas_amount: '100000',
        gas_unit_price: '100',
        expiration_timestamp_secs: Math.floor(Date.now() / 1000) + 30 // 30 seconds from now
      }

      console.log('Submitting init_wallet_creation transaction...')
      const submitResult = await provider.signAndSubmit(submitPayload, submitOpts)

      console.log('Transaction submitted:', submitResult)


      // private async makeInitTxTx(
      //   signer: Account,
      //   payload: TxnBuilderTypes.SigningMessage,
      //   signature: TxnBuilderTypes.Ed25519Signature,
      //   opts: Options
      // ) {
      //   // TODO: do not query for resource again;
      //   const txBuilder = new AptosEntryTxnBuilder();
      //   const pkIndex = this.getIndex(signer.publicKey());
      //   const config = await applyDefaultOptions(signer.address(), opts);

      //   return txBuilder
      //     .addr(DEPLOYER)
      //     .module(MODULES.MOMENTUM_SAFE)
      //     .method(FUNCTIONS.MSAFE_INIT_TRANSACTION)
      //     .from(signer.address())
      //     .withTxConfig(config)
      //     .args([
      //       BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
      //       BCS.bcsSerializeU8(pkIndex),
      //       BCS.bcsSerializeBytes(payload),
      //       BCS.bcsToBytes(signature),
      //     ])
      //     .build(signer.account);
      // }


      
      if (!signedBytes) throw new Error("Failed to get signed transaction bytes")

      // Convert to hex string
      const hexSignature = Hex.fromHexInput(signedBytes).toString()
      setSignature(hexSignature)
      
      // Notify parent component
      if (onSignatureChange) {
        onSignatureChange(hexSignature)
      }

    } catch (error) {
      console.error("Error signing transaction:", error)
      setError(error instanceof Error ? error.message : "Unknown error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  const clearResults = () => {
    setSignature("")
    setError("")
    if (onSignatureChange) {
      onSignatureChange("")
    }
  }

  const resetToDefault = () => {
    setPayload(defaultPayload)
    clearResults()
  }

  return (
    <div className="space-y-4">
      {/* MSafe Account Selector */}
      <div className="space-y-2">
        <Label htmlFor="msafe-account">MSafe Account (Optional)</Label>
        <MSafeAccountSelector
          value={selectedMSafeAccount}
          onValueChange={setSelectedMSafeAccount}
          placeholder="Select MSafe account or use wallet account"
        />
        {selectedMSafeAccount && (
          <p className="text-xs text-muted-foreground">
            Using MSafe account as sender: {selectedMSafeAccount.slice(0, 6)}...{selectedMSafeAccount.slice(-4)}
          </p>
        )}
      </div>

      {/* Payload Input */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="payload">Transaction Payload (JSON)</Label>
          <Button 
            variant="outline" 
            size="sm"
            onClick={resetToDefault}
            className="text-xs"
          >
            Reset to Default
          </Button>
        </div>
        <Textarea
          id="payload"
          value={payload}
          onChange={(e) => setPayload(e.target.value)}
          placeholder="Enter transaction payload as JSON..."
          className="min-h-[120px] font-mono text-sm"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <LoadingButton 
          onClick={signTransactionWithWallet}
          disabled={!payload.trim() || !connected}
          loading={isLoading}
          loadingText="Signing Transaction..."
          className="flex-1"
        >
          Sign Transaction
        </LoadingButton>
        <Button 
          variant="outline" 
          onClick={clearResults}
          disabled={!signature && !error}
        >
          Clear
        </Button>
      </div>

      {/* Error Display */}
      <ErrorDisplay error={error} onClear={() => setError("")} />

      {/* Results */}
      <SignatureDisplay signature={signature} onClose={clearResults} />
      
      <WalletModal 
        open={isWalletModalOpen} 
        onOpenChange={setIsWalletModalOpen} 
      />
    </div>
  )
}


// FROM Msafe: MS; From MY: MY
// MS: 0.001: b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb050000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e000220a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb08a086010000000000e8030000000000006e00000000000000d3ffb06a0000000001
// MS: 0.001: b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb050000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e000220a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb08a086010000000000e8030000000000006e000000000000002500b16a0000000001
// MS: 0.002: b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb050000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e000220a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb08400d030000000000e8030000000000006e000000000000009b00b16a0000000001
// MY: 0.001: b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb000000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e0002203311cd72df40ff27ba05d3ad80f8d72334d24b7fcafc284e52acf244580236d408a086010000000000a086010000000000640000000000000003e8cf680000000001
// MY: 0.001: b5e97db07fa0bd0e5598aa3643a9bc6f6693bddc1a9fec9e674a461eaa00b193a7d0fbd203b7286f2c725a17579e17773150d70c16c17e68d69d792d2c3704cb000000000000000002000000000000000000000000000000000000000000000000000000000000000104636f696e087472616e73666572010700000000000000000000000000000000000000000000000000000000000000010a6170746f735f636f696e094170746f73436f696e0002203311cd72df40ff27ba05d3ad80f8d72334d24b7fcafc284e52acf244580236d408a086010000000000a086010000000000640000000000000088e8cf680000000001
