import { HexString, TxnBuilderTypes, BCS } from "aptos";
import { HexBuffer, Transaction as MTransaction, type TEd25519Signature, type SimpleMap, type TEd25519PublicKey, type RevertArgs } from "./transaction";
import type { Account } from "node_modules/@aptos-labs/ts-sdk/dist/esm/api/account.d.mts";
import { isHexEqual } from "@/components/msafe-account-list";
import type { AccountAddress } from "@aptos-labs/ts-sdk";

// MSafe constants from CLI-MSafe
export const MSAFE_MODULES_ACCOUNT = "0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e";

export const MODULES = {
  MOMENTUM_SAFE: "momentum_safe",
  CREATOR: "creator",
  REGISTRY: "registry",
  TABLE_MAP: "table_map",
  COIN: "coin",
  MANAGED_COIN: "managed_coin",
  APTOS_COIN: "aptos_coin",
  CODE: "code",
} as const;

export const FUNCTIONS = {
  MSAFE_REGISTER: "register",
  MSAFE_INIT_TRANSACTION: "init_transaction",
  MSAFE_SUBMIT_SIGNATURE: "submit_signature",
  MSAFE_REVERT: "do_nothing",
  
  CREATOR_INIT_WALLET: "init_wallet_creation",
  CREATOR_SUBMIT_SIG: "submit_signature",
  
  COIN_TRANSFER: "transfer",
  COIN_REGISTER: "register",
  COIN_MINT: "mint",
  
  REGISTRY_REGISTER: "register",
  
  PUBLISH_PACKAGE: "publish_package_txn",
  
  MSAFE_INIT_MIGRATION: "init_migration",
  MSAFE_GET_STATUS: "msafe_status",
  MSAFE_MIGRATE: "migrate",
} as const;

// Types from CLI-MSafe adapted for this project
export type APTTransferArgs = {
  to: HexString;
  amount: bigint;
};

export type EntryFunctionArgs = {
  fnName: string;
  typeArgs: string[];
  args: BCS.Bytes[]; // encoded bytes
};

export type Options = {
  maxGas?: bigint;
  gasPrice?: bigint;
  expirationSec?: number; // target = time.now() + expiration
  expirationRaw?: number;
  sequenceNumber?: bigint;
  chainID?: number;
  estimateGasPrice?: boolean;
  estimateMaxGas?: boolean;
};

export type TxConfig = {
  maxGas: bigint;
  gasPrice: bigint;
  expirationSec: number; // target = time.now() + expiration
  expirationRaw?: number;
  sequenceNumber: bigint;
  chainID: number;
  estimateGasPrice: boolean;
  estimateMaxGas: boolean;
};

export interface IMultiSig {
  address: HexString;
  // rawPublicKey: TxnBuilderTypes.MultiEd25519PublicKey;
}

export interface IAccount {
  address: HexString;
  publicKey(): TxnBuilderTypes.Ed25519PublicKey;
}

// Transaction builder class (simplified version from CLI-MSafe)
export class AptosCoinTransferTxnBuilder {
  private _fromAddress: HexString | undefined;
  private _toAddress: HexString | undefined;
  private _amount: bigint | undefined;
  private _chainId: number | undefined;
  private _config: TxConfig | undefined;

  from(fromAddress: HexString): this {
    this._fromAddress = fromAddress;
    return this;
  }

  to(toAddress: HexString): this {
    this._toAddress = toAddress;
    return this;
  }

  amount(amount: bigint): this {
    this._amount = amount;
    return this;
  }

  chainId(chainId: number): this {
    this._chainId = chainId;
    return this;
  }

  withTxConfig(config: TxConfig): this {
    this._config = config;
    return this;
  }

  async build(sender: IMultiSig): Promise<Transaction> {
    if (!this._fromAddress || !this._toAddress || !this._amount || !this._config) {
      throw new Error("Missing required parameters for APT transfer transaction");
    }

    const payload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        "0x1::coin",
        "transfer",
        [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString("0x1::aptos_coin::AptosCoin"))],
        [
          BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this._toAddress)),
          BCS.bcsSerializeUint64(this._amount)
        ]
      )
    );

    const rawTxn = new TxnBuilderTypes.RawTransaction(
      TxnBuilderTypes.AccountAddress.fromHex(this._fromAddress),
      this._config.sequenceNumber,
      payload,
      this._config.maxGas,
      this._config.gasPrice,
      BigInt(Math.floor(Date.now() / 1000) + this._config.expirationSec),
      new TxnBuilderTypes.ChainId(this._config.chainID)
    );

    return new Transaction(rawTxn);
  }
}

// Generic entry function transaction builder (from CLI-MSafe)
export class AptosEntryTxnBuilder {
  private _addr: HexString | undefined;
  private _module: string | undefined;
  private _method: string | undefined;
  private _fromAddress: HexString | undefined;
  private _config: TxConfig | undefined;
  private _args: BCS.Bytes[] = [];
  private _typeArgs: TxnBuilderTypes.TypeTag[] = [];

  addr(addr: HexString | string): this {
    this._addr = HexString.ensure(addr);
    return this;
  }

  module(module: string): this {
    this._module = module;
    return this;
  }

  method(method: string): this {
    this._method = method;
    return this;
  }

  from(fromAddress: HexString): this {
    this._fromAddress = fromAddress;
    return this;
  }

  withTxConfig(config: TxConfig): this {
    this._config = config;
    return this;
  }

  args(args: BCS.Bytes[]): this {
    this._args = args;
    return this;
  }

  typeArgs(typeArgs: TxnBuilderTypes.TypeTag[]): this {
    this._typeArgs = typeArgs;
    return this;
  }

  async build(sender: IAccount | IMultiSig): Promise<Transaction> {
    if (!this._addr || !this._module || !this._method || !this._fromAddress || !this._config) {
      throw new Error("Missing required parameters for entry function transaction");
    }

    const payload = new TxnBuilderTypes.TransactionPayloadEntryFunction(
      TxnBuilderTypes.EntryFunction.natural(
        `${this._addr}::${this._module}`,
        this._method,
        this._typeArgs,
        this._args
      )
    );

    const rawTxn = new TxnBuilderTypes.RawTransaction(
      TxnBuilderTypes.AccountAddress.fromHex(this._fromAddress),
      this._config.sequenceNumber,
      payload,
      this._config.maxGas,
      this._config.gasPrice,
      this._config.expirationRaw ? BigInt(this._config.expirationRaw) : BigInt(Math.floor(Date.now() / 1000) + this._config.expirationSec),
      new TxnBuilderTypes.ChainId(this._config.chainID)
    );

    return new Transaction(rawTxn);
  }
}

// Transaction class (simplified version from CLI-MSafe)
export class Transaction {
  raw: TxnBuilderTypes.RawTransaction;

  constructor(raw: TxnBuilderTypes.RawTransaction) {
    this.raw = raw;
  }
}

// MSafeTransaction class (simplified version from CLI-MSafe)
export class MSafeTransaction extends Transaction {
  constructor(raw: TxnBuilderTypes.RawTransaction) {
    super(raw);
  }
}

// Default values
const DEFAULT_UNIT_PRICE = 1000n;
const DEFAULT_REGISTER_MAX_GAS = 50000n;
const DEFAULT_EXPIRATION = 604800; // 1 week in seconds

// Constants for parsing
const NUM_FUNCTION_COMPS = 3;

// Utility functions
export function splitFunctionComponents(s: string): [HexString, string, string] {
  const comps = s.split('::');
  if (comps.length != NUM_FUNCTION_COMPS) {
    throw new Error("invalid full function name");
  }
  return [HexString.ensure(comps[0]), comps[1], comps[2]];
}

export function typeTagStructFromName(name: string) {
  const structTag = TxnBuilderTypes.StructTag.fromString(name);
  return new TxnBuilderTypes.TypeTagStruct(structTag);
}

// Helper function to apply default options
export async function applyDefaultOptions(
  sender: HexString,
  opts?: Options
): Promise<TxConfig> {
  if (!opts) {
    opts = {};
  }
  
  const maxGas = opts.maxGas ? opts.maxGas : DEFAULT_REGISTER_MAX_GAS;
  const gasPrice = opts.gasPrice ? opts.gasPrice : DEFAULT_UNIT_PRICE;
  const expirationSec = opts.expirationSec ? opts.expirationSec : DEFAULT_EXPIRATION;

  // For now, we'll use default values. In a real implementation, these would be fetched from the blockchain
  const sequenceNumber = opts.sequenceNumber !== undefined ? opts.sequenceNumber : 0n;
  const chainID = opts.chainID !== undefined ? opts.chainID : 1; // Mainnet

  return {
    maxGas: maxGas,
    gasPrice: gasPrice,
    expirationSec: expirationSec,
    sequenceNumber: sequenceNumber,
    chainID: chainID,
    estimateGasPrice: !!opts.estimateGasPrice,
    estimateMaxGas: !!opts.estimateMaxGas,
    expirationRaw: opts.expirationRaw,
  };
}

/**
 * Creates an MSafe APT transfer transaction
 * @param sender - The multi-signature account that will send the transaction
 * @param args - Transfer arguments containing recipient and amount
 * @param opts - Optional transaction configuration
 * @returns Promise<MSafeTransaction> - The constructed MSafe transaction
 */
export async function makeMSafeAPTTransferTx(
  sender: IMultiSig,
  args: APTTransferArgs,
  opts?: Options
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  const txBuilder = new AptosCoinTransferTxnBuilder();
  const tx = await txBuilder
    .from(sender.address)
    .chainId(config.chainID)
    .withTxConfig(config)
    .to(args.to)
    .amount(args.amount)
    .build(sender);

  return new MSafeTransaction(tx.raw);
}

/**
 * Creates an MSafe entry function transaction
 * @param sender - The multi-signature account that will send the transaction
 * @param args - Entry function arguments containing function name, type args, and encoded args
 * @param opts - Optional transaction configuration
 * @returns Promise<MSafeTransaction> - The constructed MSafe transaction
 */
export async function makeEntryFunctionTx(
  sender: IMultiSig,
  args: EntryFunctionArgs,
  opts?: Options
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  const [deployer, moduleName, fnName] = splitFunctionComponents(args.fnName);
  const txBuilder = new AptosEntryTxnBuilder();
  const tx = await txBuilder
    .addr(deployer)
    .module(moduleName)
    .method(fnName)
    .from(sender.address)
    .withTxConfig(config)
    .typeArgs(args.typeArgs.map((ta) => typeTagStructFromName(ta)))
    .args(args.args)
    .build(sender);

  return new MSafeTransaction(tx.raw);
}

export async function makeSubmitSignatureTxn(
  signer: IAccount,
  txHash: string,
  pkIndex: number,
  msafeAddress: HexString,
  sig: TxnBuilderTypes.Ed25519Signature,
  opts: Options
) {
  const txBuilder = new AptosEntryTxnBuilder();
  const config = await applyDefaultOptions(signer.address, opts);

  return txBuilder
    .addr(MSAFE_MODULES_ACCOUNT)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_SUBMIT_SIGNATURE)
    .from(signer.address)
    .withTxConfig(config)
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(msafeAddress)),
      BCS.bcsSerializeU8(pkIndex),
      BCS.bcsSerializeBytes(HexBuffer(txHash)),
      BCS.bcsToBytes(sig),
    ])
    .build(signer);
}

export async function makeMSafeRevertTx(
  sender: IMultiSig,
  args: RevertArgs,
  opts?: Options
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  // sequence number will override option sn
  config.sequenceNumber = args.sn;
  const txBuilder = new AptosEntryTxnBuilder();
  const tx = await txBuilder
    .addr(MSAFE_MODULES_ACCOUNT)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_REVERT)
    .from(sender.address)
    .withTxConfig(config)
    .args([])
    .build(sender);
  return new MSafeTransaction(tx.raw);
}

/**
 * Creates an MSafe init_transaction transaction
 * @param signer - The account that will sign and submit the init transaction
 * @param msafeAddress - The MSafe account address
 * @param pkIndex - Public key index in the MSafe
 * @param payload - The signing message (transaction payload)
 * @param signature - The Ed25519 signature
 * @param opts - Optional transaction configuration
 * @returns Promise<Transaction> - The constructed init transaction
 */
export async function makeInitTx(
  signer: IAccount,
  msafeAddress: HexString,
  pkIndex: number,
  payload: TxnBuilderTypes.SigningMessage,
  signature: TxnBuilderTypes.Ed25519Signature,
  opts?: Options
): Promise<Transaction> {
  const config = await applyDefaultOptions(signer.address, opts);
  const txBuilder = new AptosEntryTxnBuilder();

  return txBuilder
    .addr(MSAFE_MODULES_ACCOUNT)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_INIT_TRANSACTION)
    .from(signer.address)
    .withTxConfig(config)
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(msafeAddress)),
      BCS.bcsSerializeU8(pkIndex),
      BCS.bcsSerializeBytes(payload),
      BCS.bcsToBytes(signature),
    ])
    .build(signer);
}

type SigAdded = {
  pubKey: HexString,
}

export class MultiSigHelper {
  /**
   * MultiSigHelper is the helper for multi-sig aggregation, query, and update
    */

  private pks: string[]; // pks might be updated in future implementation
  private sigs: Map<string, TxnBuilderTypes.Ed25519Signature>;

  constructor(pks: string[], sigs?: SimpleMap<TEd25519PublicKey, TEd25519Signature>) {
    this.pks = pks;
    this.sigs = simpleMapToSigMap(sigs);
  }

  findIndex(target: string): number {
    const i = this.pks.findIndex(pk => {
      return isHexEqual(pk, target);
    });
    if (i === -1) {
      throw new Error('target public key not found');
    }
    return i;
  }

  isSigSubmitted(pk: string): boolean {
    return this.sigs.has(pk);
  }

  numSigs(): number {
    return this.sigs.size;
  }

  updateSigs(newSigs: SimpleMap<TEd25519PublicKey, TEd25519Signature>): SigAdded[] {
    const addedSigs: SigAdded[] = [];
    newSigs.data.forEach(entry => {
      const pk = HexString.ensure(entry.key);
      if (!this.isSigSubmitted(pk.hex())) {
        addedSigs.push({ pubKey: pk });
      }
    });
    this.sigs = simpleMapToSigMap(newSigs);
    return addedSigs;
  }

  addSig(pk: string, sig: TxnBuilderTypes.Ed25519Signature) {
    this.sigs.set(pk, sig);
  }

  assembleSignatures() {
    // construct bitmap and prepare the signature for sorting
    const bitmap: number[] = [];
    const sigsUnsorted: [number, TxnBuilderTypes.Ed25519Signature][] = [];
    this.sigs.forEach((value, key) => {
      const pkIndex = this.findIndex(key);
      bitmap.push(pkIndex);
      sigsUnsorted.push([pkIndex, value]);
    });
    console.log('bitmap:', bitmap)
    // Signature need to be sorted with respect to the pkIndex
    const sigSorted = sigsUnsorted
      .sort((a, b) => a[0] - b[0])
      .map(v => v[1]);

    const parsedBitmap = TxnBuilderTypes.MultiEd25519Signature.createBitmap(bitmap);
    return new TxnBuilderTypes.MultiEd25519Signature(
      sigSorted, parsedBitmap,
    );
  }
}

function simpleMapToSigMap(smSigs: SimpleMap<TEd25519PublicKey, TEd25519Signature> | undefined): Map<string, TxnBuilderTypes.Ed25519Signature> {
  const m = new Map<string, TxnBuilderTypes.Ed25519Signature>();
  if (smSigs) {
    smSigs.data.forEach(entry => {
      const pk = HexString.ensure(entry.key);
      const sig = new TxnBuilderTypes.Ed25519Signature(HexBuffer(entry.value));
      m.set(pk.hex(), sig);
    });
  }
  return m;
}

export function assembleMultiSig(
  pubKeys: string[],
  sigs: SimpleMap<TEd25519PublicKey, TEd25519Signature>,
  currentAccountPubKey: string,
  sig?: TxnBuilderTypes.Ed25519Signature
) {
  const msh = new MultiSigHelper(pubKeys, sigs);
  if (sig) {
    msh.addSig(currentAccountPubKey, sig);
  }
  console.log('msh:', msh)
  return msh.assembleSignatures();
}

export function assembleMultiSigTxn(
  payload: string | Uint8Array,
  pubKey: TxnBuilderTypes.MultiEd25519PublicKey,
  sig: TxnBuilderTypes.MultiEd25519Signature,
  sender: string
): Uint8Array {
  const authenticator =
    new TxnBuilderTypes.TransactionAuthenticatorMultiEd25519(pubKey, sig);
  const hb =
    typeof payload === "string" ? HexBuffer(payload) : Buffer.from(payload);

  const signingTx = MTransaction.deserialize(hb, true);
  console.log('signingTx:', signingTx)
  const signedTx = new TxnBuilderTypes.SignedTransaction(
    signingTx.raw,
    authenticator
  );
  return BCS.bcsToBytes(signedTx);
}
