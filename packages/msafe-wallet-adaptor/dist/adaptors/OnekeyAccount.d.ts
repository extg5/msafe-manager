import { TxnBuilderTypes } from "aptos";
import { WebAccount } from "../lib/WebAccount";
export declare class OnekeyAccount extends WebAccount {
    get wallet(): any;
    walletSignTxnImpl(txn: TxnBuilderTypes.RawTransaction): Promise<TxnBuilderTypes.SignedTransaction>;
}
