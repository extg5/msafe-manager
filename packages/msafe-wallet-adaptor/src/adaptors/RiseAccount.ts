import { BCS, TxnBuilderTypes } from "aptos";
import { WebAccount } from "../lib/WebAccount";

export class RiseAccount extends WebAccount {
    get wallet() {
      return window.rise;
    }
  
    async walletSignTxnImpl(
      txn: TxnBuilderTypes.RawTransaction
    ): Promise<TxnBuilderTypes.SignedTransaction> {
      const bcsUnsignedTxn = BCS.bcsToBytes(txn);
      const signedPayload = await this.wallet.signTransaction(
        bcsUnsignedTxn,
        {
          payloadType: 'bcs_payload',
          readOnly: true,
        }
      );

      const deserializer = new BCS.Deserializer(signedPayload.signature);
      return TxnBuilderTypes.SignedTransaction.deserialize(deserializer);
    }
  }
  