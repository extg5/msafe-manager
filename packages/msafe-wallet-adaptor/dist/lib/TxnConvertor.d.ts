import { HexString, TxnBuilderTypes, Types } from "aptos";
declare type fmt = (type: string, arg: any) => any;
export declare class EntryFunctionTxnConvertor {
    readonly fmt: fmt;
    constructor(fmt: fmt);
    getABI(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): Promise<Types.MoveFunction>;
    decodeParam(arg: Uint8Array, argType: Types.MoveType): any;
    decodeParams(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): Promise<any[]>;
    getGenericArgTags(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): string[];
    getFunctionName(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): {
        module_address: HexString;
        module_name: string;
        function_name: string;
    };
    getFunctionTag(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): string;
    getSigningPayload(payload: TxnBuilderTypes.TransactionPayloadEntryFunction): Promise<{
        function: string;
        type_arguments: string[];
        arguments: any[];
    }>;
    getSigningOption(rawTxn: TxnBuilderTypes.RawTransaction): {
        max_gas_amount: string;
        gas_unit_price: string;
        expiration_timestamp_secs: string;
        sequence_number: string;
        sender: string;
    };
}
export {};
