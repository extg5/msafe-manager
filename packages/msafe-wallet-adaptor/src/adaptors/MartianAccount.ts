import { BCS, TxnBuilderTypes } from "aptos";
import { WebAccount } from "../lib/WebAccount";

// martian work fine with us
export class MartianAccount extends WebAccount {
    get wallet() {
      return window.martian;
    }
  
    async walletSignTxnImpl(
      txn: TxnBuilderTypes.RawTransaction
    ): Promise<TxnBuilderTypes.SignedTransaction> {
      const bcsUnsignedTxn = BCS.bcsToBytes(txn);
      const arrayStr: string = await this.wallet.signTransaction(
        Array.from(bcsUnsignedTxn).toString()
      );
      const bcsSignedTxn = Uint8Array.from(arrayStr.split(",").map((s) => Number(s)));
      return TxnBuilderTypes.SignedTransaction.deserialize(
        new BCS.Deserializer(bcsSignedTxn)
      );
    }
  }
  