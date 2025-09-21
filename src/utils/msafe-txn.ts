import { HexString, TxnBuilderTypes, TransactionBuilder, BCS } from "aptos";

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

export type Options = {
  maxGas?: bigint;
  gasPrice?: bigint;
  expirationSec?: number; // target = time.now() + expiration
  sequenceNumber?: bigint;
  chainID?: number;
  estimateGasPrice?: boolean;
  estimateMaxGas?: boolean;
};

export type TxConfig = {
  maxGas: bigint;
  gasPrice: bigint;
  expirationSec: number; // target = time.now() + expiration
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
