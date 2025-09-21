import { BCS, HexString, TxnBuilderTypes } from "aptos";
import { EntryFunctionTxnConvertor } from "../lib/TxnConvertor";
import { WebAccount } from "../lib/WebAccount";

// petra can't be test
export class PetraAccount extends WebAccount {
    get wallet() {
      return window.petra;
    }
  
    async walletSignTxnImpl(
      txn: TxnBuilderTypes.RawTransaction
    ): Promise<TxnBuilderTypes.SignedTransaction> {
      const txnConvertor = new EntryFunctionTxnConvertor(PetraAccount.fmt);
      const payload = txn.payload;
      if (!(payload instanceof TxnBuilderTypes.TransactionPayloadEntryFunction))
        throw Error("only support EntryFunction");
      const option = txnConvertor.getSigningOption(txn);
      const signingOption = {
        type: "entry_function_payload",
        gasUnitPrice: option.gas_unit_price,
        maxGasFee: option.max_gas_amount,
        sender: option.sender,
        expirationTimestamp: option.expiration_timestamp_secs,
        sequenceNumber: option.sequence_number,
      };
      try {
        const signedPayload: { [index: number]: number } =
          await this.wallet.signTransaction(txn.payload, signingOption);
        const deserializer = new BCS.Deserializer(
          Uint8Array.from(Object.values(signedPayload))
        );
        const signedTxn =
          TxnBuilderTypes.SignedTransaction.deserialize(deserializer);
        return signedTxn;
      } catch (e) {
        console.error(e);
        throw e;
      }
    }
  
    static fmt(type: string, arg: any) {
      switch (type) {
        case "address":
          return HexString.fromUint8Array(arg).hex();
        case "u8":
        case "u64":
        case "u128":
          return String(arg);
        case "vector<u8>":
          return arg;
      }
      return arg;
    }
  }