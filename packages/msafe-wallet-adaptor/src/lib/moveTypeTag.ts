import { HexString, TxnBuilderTypes, Types } from "aptos";

export type MoveTypeTag =
  | MovePrimeTypeTag
  | MoveVectorTypeTag
  | MoveStructTypeTag;

export type MovePrimeTypeTag =
  | "bool"
  | "u8"
  | "u64"
  | "u128"
  | "address"
  | "signer";

export class MoveVectorTypeTag {
  constructor(public readonly element: MoveTypeTag) {}
  toString(): string {
    return this.element.toString();
  }
}

export class MoveStructTypeTag {
  typeArgsOffset?: number;
  typeArgsNum = 0;
  TypeArgs: MoveTypeTag[] = [];

  constructor(
    public readonly Address: HexString,
    public readonly ModuleName: string,
    public readonly StructName: string
  ) {
    const found = StructName.match(/<[a-zA-Z0-9]+(,[a-zA-Z0-9]+){0,}>/);
    if (found) {
      this.typeArgsOffset = found.index!;
      this.typeArgsNum = 1 + (StructName.match(/,/g)?.length || 0);
    }
  }

  args(typeArgs: MoveTypeTag[]): this {
    if (this.typeArgsNum != typeArgs.length) {
      throw `wrong number of type arguments, expected ${this.typeArgsNum}, got ${typeArgs.length}`;
    }
    this.TypeArgs = typeArgs;
    return this;
  }

  typeArgsString(): string {
    if (this.typeArgsNum != this.TypeArgs.length) {
      throw `wrong number of type arguments, expected ${this.typeArgsNum}, got ${this.TypeArgs.length}`;
    }
    return this.typeArgsNum
      ? `<${this.TypeArgs.map((arg) => arg.toString()).join(",")}>`
      : "";
  }

  toString(shortAddress = true) {
    const address = shortAddress
      ? this.Address.toShortString()
      : this.Address.hex();
    return `${address}::${this.ModuleName}::${this.StructName.slice(
      0,
      this.typeArgsOffset
    )}${this.typeArgsString()}`;
  }
  toMoveStructTag(): Types.MoveStructTag {
    return this.toString();
  }
}

export function fromAptosMoveTag(
  type_tag: TxnBuilderTypes.TypeTag
): MoveTypeTag {
  if (type_tag instanceof TxnBuilderTypes.TypeTagBool) {
    return "bool";
  }
  if (type_tag instanceof TxnBuilderTypes.TypeTagU8) {
    return "u8";
  }
  if (type_tag instanceof TxnBuilderTypes.TypeTagU64) {
    return "u64";
  }
  if (type_tag instanceof TxnBuilderTypes.TypeTagU128) {
    return "u128";
  }
  if (type_tag instanceof TxnBuilderTypes.TypeTagAddress) {
    return "address";
  }
  if (type_tag instanceof TxnBuilderTypes.TypeTagSigner) {
    return "signer";
  }
  if (type_tag instanceof TxnBuilderTypes.TypeTagVector) {
    const elemTypeTag = fromAptosMoveTag(type_tag.value);
    return new MoveVectorTypeTag(elemTypeTag);
  }
  if (type_tag instanceof TxnBuilderTypes.TypeTagStruct) {
    const struct_tag = type_tag.value;
    const structTypeArgs = struct_tag.type_args.map((arg) =>
      fromAptosMoveTag(arg)
    );
    const address = HexString.fromUint8Array(struct_tag.address.address);
    const module_name = struct_tag.module_name.value;
    const struct_name = struct_tag.name.value;
    return new MoveStructTypeTag(address, module_name, struct_name).args(
      structTypeArgs
    );
  }
  throw Error("unknown type args");
}
