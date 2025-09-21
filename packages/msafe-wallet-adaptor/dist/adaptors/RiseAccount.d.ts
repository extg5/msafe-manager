import { TxnBuilderTypes } from "aptos";
import { WebAccount } from "../lib/WebAccount";
export declare class RiseAccount extends WebAccount {
    get wallet(): any;
    walletSignTxnImpl(txn: TxnBuilderTypes.RawTransaction): Promise<TxnBuilderTypes.SignedTransaction>;
}
