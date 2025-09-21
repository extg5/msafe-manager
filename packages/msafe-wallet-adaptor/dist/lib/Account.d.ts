import { HexString, TxnBuilderTypes } from "aptos";
import { BCS } from 'aptos';
declare type MayPromise<T> = T | Promise<T>;
export declare type SigData = [signing: TxnBuilderTypes.SigningMessage, signature: TxnBuilderTypes.Ed25519Signature];
export interface Account {
    address(): HexString;
    publicKey(): HexString;
    publicKeyBytes(): BCS.Bytes;
    sign(txn: TxnBuilderTypes.RawTransaction): MayPromise<BCS.Bytes>;
    getSigData(txn: TxnBuilderTypes.RawTransaction): MayPromise<SigData>;
}
export {};
