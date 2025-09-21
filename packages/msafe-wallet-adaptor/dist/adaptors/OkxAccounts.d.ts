import { TxnBuilderTypes } from "aptos";
import { WebAccount } from "../lib/WebAccount";
export declare class OkxAccount extends WebAccount {
    get wallet(): any;
    walletSignTxnImpl(txn: TxnBuilderTypes.RawTransaction): Promise<TxnBuilderTypes.SignedTransaction>;
    static fmt(type: string, arg: any): any;
}
