import { HexString, TxnBuilderTypes, Types } from "aptos";
export declare type MoveTypeTag = MovePrimeTypeTag | MoveVectorTypeTag | MoveStructTypeTag;
export declare type MovePrimeTypeTag = "bool" | "u8" | "u64" | "u128" | "address" | "signer";
export declare class MoveVectorTypeTag {
    readonly element: MoveTypeTag;
    constructor(element: MoveTypeTag);
    toString(): string;
}
export declare class MoveStructTypeTag {
    readonly Address: HexString;
    readonly ModuleName: string;
    readonly StructName: string;
    typeArgsOffset?: number;
    typeArgsNum: number;
    TypeArgs: MoveTypeTag[];
    constructor(Address: HexString, ModuleName: string, StructName: string);
    args(typeArgs: MoveTypeTag[]): this;
    typeArgsString(): string;
    toString(shortAddress?: boolean): string;
    toMoveStructTag(): Types.MoveStructTag;
}
export declare function fromAptosMoveTag(type_tag: TxnBuilderTypes.TypeTag): MoveTypeTag;
