import { BCS, HexString, TxnBuilderTypes } from "aptos";
import { WebAccount } from "../lib/WebAccount";

export class OnekeyAccount extends WebAccount {
    get wallet() {
      return window.$onekey.aptos;
    }
  
    async walletSignTxnImpl(
      txn: TxnBuilderTypes.RawTransaction
    ): Promise<TxnBuilderTypes.SignedTransaction> {
      const bcsUnsignedTxn = BCS.bcsToBytes(txn);
      const arrayStr: string = await this.wallet.signTransaction(
        HexString.fromUint8Array(bcsUnsignedTxn).noPrefix()
      );
      const bcsSignedTxn = Uint8Array.from(arrayStr.split(",").map((s) => Number(s)));
      return TxnBuilderTypes.SignedTransaction.deserialize(
        new BCS.Deserializer(bcsSignedTxn)
      );
    }
  }
  