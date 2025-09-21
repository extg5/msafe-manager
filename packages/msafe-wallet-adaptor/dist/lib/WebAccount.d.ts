import { HexString, TxnBuilderTypes, BCS } from "aptos";
import { Account, SigData } from "./Account";
export declare abstract class WebAccount implements Account {
    readonly _address: string;
    readonly _publicKey: string;
    abstract wallet: any;
    abstract walletSignTxnImpl(txn: TxnBuilderTypes.RawTransaction): Promise<TxnBuilderTypes.SignedTransaction>;
    constructor(_address: string, _publicKey: string);
    address(): HexString;
    publicKey(): HexString;
    publicKeyBytes(): BCS.Bytes;
    walletSignTxn(txn: TxnBuilderTypes.RawTransaction): Promise<TxnBuilderTypes.SignedTransaction>;
    sign(txn: TxnBuilderTypes.RawTransaction): Promise<BCS.Bytes>;
    getSigData(txn: TxnBuilderTypes.RawTransaction): Promise<SigData>;
}
