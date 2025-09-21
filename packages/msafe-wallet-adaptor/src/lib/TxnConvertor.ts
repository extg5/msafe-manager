import { BCS, HexString, TxnBuilderTypes, Types } from "aptos";
import { getFunctionABI } from "./getRemoteABI";
import { fromAptosMoveTag } from "./moveTypeTag";

type fmt = (type: string, arg: any) => any;
class ABIDecoder {
  static decode(
    deserializer: BCS.Deserializer,
    argType: Types.MoveType,
    fmt: fmt
  ): any {
    if (argType === "vector<u8>") {
      return fmt("vector<u8>", deserializer.deserializeBytes());
    }
    if (argType.startsWith("vector<")) {
      const length = deserializer.deserializeUleb128AsU32();
      const vec = [];
      for (let i = 0; i < length; i++) {
        const elem = this.decode(deserializer, argType.slice(7, -1), fmt); // vector element
        vec.push(elem);
      }
      return vec;
    }
    switch (argType) {
      case "u8":
        return fmt("u8", deserializer.deserializeU8());
      case "u64":
        return fmt("u64", deserializer.deserializeU64());
      case "u128":
        return fmt("u128", deserializer.deserializeU128());
      case "address":
        return fmt("address", deserializer.deserializeFixedBytes(32));
      case "bool":
        return fmt("bool", deserializer.deserializeBool());
    }
    throw Error(`unknow type: ${argType}`);
  }
}
export class EntryFunctionTxnConvertor {
  constructor(readonly fmt: fmt) {}
  async getABI(
    payload: TxnBuilderTypes.TransactionPayloadEntryFunction
  ): Promise<Types.MoveFunction> {
    const { module_address, module_name, function_name } =
      this.getFunctionName(payload);
    return getFunctionABI(module_address, module_name, function_name);
  }

  decodeParam(arg: Uint8Array, argType: Types.MoveType) {
    return ABIDecoder.decode(new BCS.Deserializer(arg), argType, this.fmt);
  }

  async decodeParams(payload: TxnBuilderTypes.TransactionPayloadEntryFunction) {
    const abi = await this.getABI(payload);
    return abi.params
      .filter((param) => !param.match(/[&]signer/))
      .map((arg, i) => this.decodeParam(payload.value.args[i], arg));
  }

  getGenericArgTags(payload: TxnBuilderTypes.TransactionPayloadEntryFunction) {
    return payload.value.ty_args.map((arg) => fromAptosMoveTag(arg).toString());
  }

  getFunctionName(payload: TxnBuilderTypes.TransactionPayloadEntryFunction) {
    const module_address = HexString.fromUint8Array(
      payload.value.module_name.address.address
    );
    const module_name = payload.value.module_name.name.value;
    const function_name = payload.value.function_name.value;
    return { module_address, module_name, function_name };
  }

  getFunctionTag(payload: TxnBuilderTypes.TransactionPayloadEntryFunction) {
    const { module_address, module_name, function_name } =
      this.getFunctionName(payload);
    return `${module_address.toShortString()}::${module_name}::${function_name}`;
  }

  async getSigningPayload(
    payload: TxnBuilderTypes.TransactionPayloadEntryFunction
  ) {
    return {
      function: this.getFunctionTag(payload),
      type_arguments: this.getGenericArgTags(payload),
      arguments: await this.decodeParams(payload),
    };
  }

  getSigningOption(rawTxn: TxnBuilderTypes.RawTransaction) {
    return {
      max_gas_amount: rawTxn.max_gas_amount.toString(),
      gas_unit_price: rawTxn.gas_unit_price.toString(),
      expiration_timestamp_secs: rawTxn.expiration_timestamp_secs.toString(),
      sequence_number: rawTxn.sequence_number.toString(),
      sender: HexString.fromUint8Array(rawTxn.sender.address).hex(),
    };
  }
}
