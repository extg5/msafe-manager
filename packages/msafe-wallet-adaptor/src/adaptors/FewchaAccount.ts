import { BCS, HexString, TxnBuilderTypes } from "aptos";
import { WebAccount } from "../lib/WebAccount";

export class FewchaAccount extends WebAccount {
    get wallet() {
      return window.fewcha;
    }
  
    async walletSignTxnImpl(
      txn: TxnBuilderTypes.RawTransaction
    ): Promise<TxnBuilderTypes.SignedTransaction> {
      const bcsUnsignedTxn = BCS.bcsToBytes(txn);
      const response: { data: number[] } = await this.wallet.aptos.signMultiSignTransaction(
        bcsUnsignedTxn
      );
      const publicKey = new TxnBuilderTypes.Ed25519PublicKey(this.publicKeyBytes());
      const signature = new TxnBuilderTypes.Ed25519Signature(Uint8Array.from(response.data));
      const authenticator = new TxnBuilderTypes.TransactionAuthenticatorEd25519(publicKey, signature);
      return new TxnBuilderTypes.SignedTransaction(txn, authenticator);
    }
  }
  