import type { TransactionType } from "@/components/msafe-account-list";
import { BCS, HexString, TransactionBuilder, TxnBuilderTypes, Types, type MaybeHexString } from "aptos";
import { sha3_256 as sha3Hash } from "@noble/hashes/sha3";

export class Transaction {
  raw: TxnBuilderTypes.RawTransaction;

  constructor(raw: TxnBuilderTypes.RawTransaction) {
    this.raw = raw;
  }

  static deserialize(rawTx: Uint8Array) {
    const deserializer = new BCS.Deserializer(rawTx.slice(32)); // skip prefix, see TransactionBuilder.getSigningMessage
    return new Transaction(
      TxnBuilderTypes.RawTransaction.deserialize(deserializer)
    );
  }

  getSigningMessage() {
    return TransactionBuilder.getSigningMessage(this.raw);
  }
}

export class TypeMessage {
  constructor(public readonly raw: MigrationProofMessage) {}

  static deserialize(rawTx: Uint8Array) {
    return new TypeMessage(MigrationProofMessage.fromBytes(rawTx));
  }

  getSigningMessage() {
    return this.raw instanceof MigrationProofMessage
      ? this.raw.toBytes()
      : TransactionBuilder.getSigningMessage(this.raw);
  }

  static isTypeMessage(rawTx: Uint8Array) {
    return MigrationProofMessage.isMigrationProofMessage(rawTx);
  }
}


export type Serializable = { serialize(serializer: BCS.Serializer): void };

export class TypeInfo {
    constructor(
      public readonly account_address: TxnBuilderTypes.AccountAddress,
      public readonly module_name: string,
      public readonly struct_name: string
    ) {}
  
    serialize(serializer: BCS.Serializer): void {
      this.account_address.serialize(serializer);
      serializer.serializeBytes(Buffer.from(this.module_name));
      serializer.serializeBytes(Buffer.from(this.struct_name));
    }
  
    toBytes(): BCS.Bytes {
      const serializer = new BCS.Serializer();
      this.serialize(serializer);
      return serializer.getBytes();
    }
  
    static deserialize(deserializer: BCS.Deserializer): TypeInfo {
      const account_address =
        TxnBuilderTypes.AccountAddress.deserialize(deserializer);
      const module_name = deserializer.deserializeStr();
      const struct_name = deserializer.deserializeStr();
      return new TypeInfo(account_address, module_name, struct_name);
    }
  
    static fromBytes(bytes: BCS.Bytes): TypeInfo {
      return TypeInfo.deserialize(new BCS.Deserializer(bytes));
    }
  }

export class SignedMessage<T extends Serializable> {
    constructor(public readonly type_info: TypeInfo, public readonly inner: T) {}
  
    serialize(serializer: BCS.Serializer): void {
      this.type_info.serialize(serializer);
      this.inner.serialize(serializer);
    }
  
    toBytes(): BCS.Bytes {
      const serializer = new BCS.Serializer();
      this.serialize(serializer);
      return serializer.getBytes();
    }
  }
  
  class MultisigAccountCreationMessage {
    constructor(
      // Chain id is included to prevent cross-chain replay.
      public readonly chain_id: TxnBuilderTypes.ChainId,
      // Account address is included to prevent cross-account replay (when multiple accounts share the same auth key).
      public readonly account_address: TxnBuilderTypes.AccountAddress,
      // Sequence number is not needed for replay protection as the multisig account can only be created once.
      // But it's included to ensure timely execution of account creation.
      public readonly sequence_number: BCS.Uint64,
      // The list of owners for the multisig account.
      public readonly owners: BCS.Seq<TxnBuilderTypes.AccountAddress>,
      // The number of signatures required (signature threshold).
      public readonly num_signatures_required: BCS.Uint64
    ) {}
  
    serialize(serializer: BCS.Serializer): void {
      this.chain_id.serialize(serializer);
      this.account_address.serialize(serializer);
      serializer.serializeU64(this.sequence_number);
      BCS.serializeVector(this.owners, serializer);
      serializer.serializeU64(this.num_signatures_required);
    }
  
    static deserialize(
      deserializer: BCS.Deserializer
    ): MultisigAccountCreationMessage {
      const chain_id = TxnBuilderTypes.ChainId.deserialize(deserializer);
      const account_address =
        TxnBuilderTypes.AccountAddress.deserialize(deserializer);
      const sequence_number = deserializer.deserializeU64();
      const owners = BCS.deserializeVector(
        deserializer,
        TxnBuilderTypes.AccountAddress
      );
      const num_signatures_required = deserializer.deserializeU64();
      return new MultisigAccountCreationMessage(
        chain_id,
        account_address,
        sequence_number,
        owners,
        num_signatures_required
      );
    }
  }
  
  export class MigrationProofMessage extends SignedMessage<MultisigAccountCreationMessage> {
    // aptos_framework::multisig_account::MultisigAccountCreationMessage
    static TYPE_INFO = new TypeInfo(
      TxnBuilderTypes.AccountAddress.fromHex("0x1"),
      "multisig_account",
      "MultisigAccountCreationWithAuthKeyRevocationMessage"
    );
    constructor(
      chain_id: BCS.Uint8,
      account_address: MaybeHexString,
      sequence_number: BCS.Uint64,
      owners: BCS.Seq<MaybeHexString>,
      num_signatures_required: BCS.Uint64
    ) {
      const innerMessage = new MultisigAccountCreationMessage(
        new TxnBuilderTypes.ChainId(chain_id),
        TxnBuilderTypes.AccountAddress.fromHex(account_address),
        sequence_number,
        owners.map(TxnBuilderTypes.AccountAddress.fromHex),
        num_signatures_required
      );
      super(MigrationProofMessage.TYPE_INFO, innerMessage);
    }
  
    toString(): string {
      return `${toHexAddress(this.type_info.account_address)}::${
        this.type_info.module_name
      }::${this.type_info.struct_name} {
          chain_id: ${this.inner.chain_id.value},
          account_address: ${toHexAddress(this.inner.account_address)},
          sequence_number: ${this.inner.sequence_number.toString()},
          owners: [${this.inner.owners.map(toHexAddress).join(",")}],
          num_signatures_required: ${this.inner.num_signatures_required.toString()},\n}`;
    }
  
    static deserialize(deserializer: BCS.Deserializer): MigrationProofMessage {
      TypeInfo.deserialize(deserializer);
      const innerMessage =
        MultisigAccountCreationMessage.deserialize(deserializer);
      return new MigrationProofMessage(
        innerMessage.chain_id.value,
        toHexAddress(innerMessage.account_address),
        innerMessage.sequence_number,
        innerMessage.owners.map(toHexAddress),
        innerMessage.num_signatures_required
      );
    }
  
    static fromBytes(bytes: BCS.Bytes): MigrationProofMessage {
      if (!this.isMigrationProofMessage(bytes)) {
        throw new Error("Invalid type info");
      }
      const deserializer = new BCS.Deserializer(bytes);
      return this.deserialize(deserializer);
    }
  
    static isMigrationProofMessage(bytes: BCS.Bytes): boolean {
      const type_encoded = this.TYPE_INFO.toBytes();
      return (
        Buffer.compare(bytes.slice(0, type_encoded.length), type_encoded) === 0
      );
    }
  }

  const toHexAddress = (account: TxnBuilderTypes.AccountAddress) =>
    HexString.fromUint8Array(account.address).hex();

  export function HexBuffer(hex: HexString | string): Buffer {
    if (typeof hex === 'string') {
      return Buffer.from(hex.startsWith('0x') ? hex.slice(2) : hex, 'hex');
    }
    return Buffer.from(hex.toUint8Array());
  }

  export enum MSafeTxnType {
    Unknown = "Unknown transaction",
    APTCoinTransfer = "Transfer APT",
    AnyCoinTransfer = "Transfer COIN",
    AnyCoinRegister = "Register COIN",
    Revert = "Revert transaction",
    EntryFunction = "Entry function",
    ModulePublish = "Module publish",
    MoveScript = "Move script",
    Migrate = "Migrate MSafe",
  }

  export type EntryFunctionArgs = {
    fnName: string;
    typeArgs: string[];
    args: BCS.Bytes[]; // encoded bytes
  };
  
  export type ModulePublishArgs = {
    moveDir: string;
  };
  
  export type ModulePublishInfo = {
    hash: HexString;
    metadata: {}; // eslint-disable-line @typescript-eslint/no-empty-object-type
    byteCode: Buffer;
  };

  export type MSafeRegisterArgs = {
    metadata: string;
  };
  
  export type CoinTransferArgs = {
    coinType: string;
    to: HexString;
    amount: bigint;
  };

  export type CoinRegisterArgs = {
    coinType: string;
  };

  export type APTTransferArgs = {
    to: HexString;
    amount: bigint;
  };

  export type RevertArgs = {
    sn: bigint; // The sn will override option.sequenceNumber
  };

  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  export type MigrateInfo = {};
  
  export type payloadInfo =
  | CoinTransferArgs
  | CoinRegisterArgs
  | APTTransferArgs
  | RevertArgs
  | EntryFunctionArgs
  | ModulePublishInfo
  | MigrateInfo;

  export type MSafeTxnInfo = {
    txType: MSafeTxnType;
    hash: HexString;
    sender: HexString;
    sn: bigint;
    expiration: Date;
    chainID: number;
    gasPrice: bigint;
    maxGas: bigint;
    args: payloadInfo;
    numSigs?: number;
    isSigned?: boolean;
    signatures?: SimpleMap<TEd25519PublicKey, TEd25519Signature>;
    payload?: TxnBuilderTypes.RawTransaction;
  };

  export type Element<K, V> = {
    key: K,
    value: V
}
  export type SimpleMap<K extends string, V> = {
    data: Element<K, V>[]
}

export type TEd25519PublicKey = Types.Ed25519Signature['public_key']
export type TEd25519Signature = Types.Ed25519Signature['signature']

  export function toMigrateTx(tx: TransactionType): MSafeTxnInfo {
    const payload = HexBuffer(tx.payload);
    const message = TypeMessage.deserialize(payload);
    const migrationMessage = message.raw.inner;
    return {
      txType: MSafeTxnType.Migrate,
      sn: migrationMessage.sequence_number,
      hash: sha3_256(message.raw.toBytes()),
      chainID: migrationMessage.chain_id.value,
      expiration: new Date(),
      sender: HexString.ensure(migrationMessage.account_address.toHexString()),
      gasPrice: 0n,
      maxGas: 0n,
      args: {},
      numSigs: tx.signatures.data.length,
      isSigned: true,
      signatures: tx.signatures,
    };
  }

  export function secToDate(sec: BCS.Uint64) {
    const ms = Number(sec) * 1000;
    return new Date(ms);
  }

  function getModuleComponents(
    payload: TxnBuilderTypes.TransactionPayloadEntryFunction
  ): [HexString, string, string] {
    const moduleName = payload.value.module_name;
    const deployer = moduleName.address.address;
    const module = moduleName.name.value;
    const fnName = payload.value.function_name.value;
    return [HexString.fromUint8Array(deployer), module, fnName];
  }

  // Used to calculate the temporary hash of the transaction payload
export function sha3_256(payload: Uint8Array): HexString {
    const hash = sha3Hash.create();
    hash.update(payload);
    return HexString.fromUint8Array(hash.digest());
  }

  function decodeTypeArgs(
    payload: TxnBuilderTypes.TransactionPayloadEntryFunction
  ): string[] {
    const tArgs = payload.value.ty_args;
    return tArgs.map((tArg) => decodeTypeTag(tArg));
  }

  function parseTypeStructTag(typeTag: TxnBuilderTypes.TypeTagStruct) {
    const deployer = typeTag.value.address.address;
    const moduleName = typeTag.value.module_name.value;
    const structName = typeTag.value.name.value;
    const deployerDisplay = HexString.fromUint8Array(deployer);
    if (typeTag.value.type_args.length === 0) {
      return `${deployerDisplay}::${moduleName}::${structName}`;
    }
  
    const tArgsDisplay = typeTag.value.type_args.map((tArg) =>
      decodeTypeTag(tArg)
    );
    return `${deployerDisplay}::${moduleName}::${structName}<${tArgsDisplay.join(
      ", "
    )}>`;
  }

function decodeTypeTag(tArg: TxnBuilderTypes.TypeTag): string {
  if (tArg instanceof TxnBuilderTypes.TypeTagStruct) {
    return parseTypeStructTag(tArg);
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagU8) {
    return "u8";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagU64) {
    return "u64";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagU128) {
    return "u128";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagAddress) {
    return "address";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagBool) {
    return "bool";
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagVector) {
    const innerType = decodeTypeTag(tArg);
    return `vector<${innerType}>`;
  }
  if (tArg instanceof TxnBuilderTypes.TypeTagSigner) {
    return "&signer";
  }
  throw new Error("unknown type tag");
}

 export class MSafeTransaction extends Transaction {
  payload: TxnBuilderTypes.RawTransaction;

  constructor(raw: TxnBuilderTypes.RawTransaction) {
    super(raw);
    if (
      !(
        raw.payload instanceof
          TxnBuilderTypes.TransactionPayloadEntryFunction ||
        raw.payload instanceof TxnBuilderTypes.TransactionPayloadScript
      )
    ) {
      throw new Error("unknown transaction payload type");
    }
    this.payload = raw;
  }

  static deserialize(rawTx: Buffer): MSafeTransaction {
    const tx = Transaction.deserialize(rawTx);
    return new MSafeTransaction(tx.raw);
  }

  getTxnInfo(signatures?: SimpleMap<TEd25519PublicKey, TEd25519Signature>, publicKey?: string): MSafeTxnInfo {
    const tx = this.raw;
    const args = this.getArgs();
    return {
      txType: args ? MSafeTxnType.EntryFunction : MSafeTxnType.Unknown,
      hash: sha3_256(TransactionBuilder.getSigningMessage(tx)),
      sender: HexString.fromUint8Array(tx.sender.address),
      sn: tx.sequence_number,
      expiration: secToDate(tx.expiration_timestamp_secs),
      chainID: tx.chain_id.value,
      gasPrice: tx.gas_unit_price,
      maxGas: tx.max_gas_amount,
      args: args ?? {},
      numSigs: signatures?.data.length,
      isSigned: publicKey ? !!signatures?.data.find((sig) => sig.key === publicKey) : false,
      signatures: signatures,
      payload: this.payload,
    };
  }

  private getArgs() {
    const payload = this
      .payload.payload as TxnBuilderTypes.TransactionPayloadEntryFunction;
    try {
        const [addr, moduleName, fnName] = getModuleComponents(payload);
        const tArgs = decodeTypeArgs(payload);
        const args = payload.value.args;
        return {
          fnName: `${addr}::${moduleName}::${fnName}`,
          typeArgs: tArgs,
          args: args,
        };
    } catch (e) {
        console.error("Failed to get args", e);
        return null;
    }
  }
}