# Momentum Safe (MSafe) - Complete Guide to Creating and Using Multisig Wallets on Aptos

## Table of Contents
1. [Introduction](#introduction)
2. [Installation and Setup](#installation-and-setup)
3. [Registry Registration](#registry-registration)
4. [Creating Multisig Wallet](#creating-multisig-wallet)
5. [Signing Wallet Creation](#signing-wallet-creation)
6. [Depositing Funds](#depositing-funds)
7. [Creating and Signing Transactions](#creating-and-signing-transactions)
8. [Withdrawing Funds](#withdrawing-funds)
9. [Code Examples](#code-examples)

## Introduction

Momentum Safe (MSafe) is a multisig wallet system on the Aptos blockchain that allows creating wallets with multiple signatures, where transaction execution requires confirmation from a specified number of owners.

### Main System Components:

- **Registry** - registry for user registration and their public keys
- **Creator** - module for creating multisig wallets
- **MomentumSafe** - main module for managing multisig wallets
- **CLI** - command line interface for system interaction

## Installation and Setup

### Prerequisites

1. Install Aptos CLI:
```bash
# Download and install from GitHub releases
# https://github.com/aptos-labs/aptos-core/releases
```

2. Clone the repository:
```bash
git clone git@github.com:Momentum-Safe/CLI-MSafe.git
cd CLI-MSafe
```

3. Install dependencies:
```bash
yarn install
```

### Wallet Setup

Initialize Aptos wallet:
```bash
aptos init
```

This will create a `.aptos/config.yaml` file with wallet settings:
```yaml
---
profiles:
  default:
    private_key: "0x..."
    public_key: "0x..."
    account: "0x..."
    rest_url: "https://fullnode.devnet.aptoslabs.com"
    faucet_url: "https://faucet.devnet.aptoslabs.com"
```

## Registry Registration

Before creating a multisig wallet, each participant must register in the system registry.

### Registration Code

```typescript
// src/momentum-safe/registry.ts
export class Registry {
  static async register(signer: Account) {
    const tx = await this.getRegisterTx(signer, {
      estimateGasPrice: true,
      estimateMaxGas: true,
    });
    const signedTx = signer.sign(tx);
    return await Aptos.sendSignedTransactionAsync(signedTx);
  }

  private static async getRegisterTx(signer: Account, opts: Options) {
    const config = await applyDefaultOptions(signer.address(), opts);
    const txBuilder = new AptosEntryTxnBuilder();
    return txBuilder
      .addr(DEPLOYER)
      .module(MODULES.REGISTRY)
      .method(FUNCTIONS.REGISTRY_REGISTER)
      .from(signer.address())
      .withTxConfig(config)
      .args([
        BCS.bcsSerializeBytes(signer.publicKeyBytes()),
      ])
      .build(signer.account);
  }
}
```

### Registration Check

```typescript
static async isRegistered(address: HexString): Promise<boolean> {
  address = formatAddress(address);
  let res: any;
  try {
    res = await Aptos.getAccountResource(address, getStructType('REGISTRY').toMoveStructTag());
  } catch (e) {
    if (e instanceof ApiError && e.message.includes("Resource not found")) {
      return false;
    }
    throw e;
  }
  return res != undefined;
}
```

### Getting Registry Data

```typescript
static async getRegistryData(address: HexString): Promise<{
  publicKey: HexString,
  pendings: HexString[],
  msafes: HexString[]
}> {
  const res = await Aptos.getAccountResource(address, getStructType('REGISTRY').toMoveStructTag());
  if (!res) {
    throw new Error(`Address not registered in momentum safe: ${address}`);
  }
  const ownedMSafes = res.data as OwnerMomentumSafes;
  const msafes = await Registry.queryAllMsafes(ownedMSafes);
  return {
    publicKey: HexString.ensure(ownedMSafes.public_key),
    pendings: msafes.pendings.map((addr) => formatAddress(addr)),
    msafes: msafes.msafes.map((addr) => formatAddress(addr)),
  };
}
```

## Creating Multisig Wallet

### Creation Process

Creating a multisig wallet happens in several stages:

1. **Creation Initialization** - the first owner initiates the process
2. **Signature Collection** - other owners sign the creation transaction
3. **Execution** - when enough signatures are collected, the wallet is created

### CreationHelper Class

```typescript
// src/momentum-safe/creation.ts
export class CreationHelper {
  address: HexString;
  rawPublicKey: TxnBuilderTypes.MultiEd25519PublicKey;

  protected constructor(
    readonly owners: HexString[],
    readonly ownerPubKeys: HexString[],
    readonly threshold: number,
    readonly creationNonce: bigint,
    readonly initBalance?: bigint,
  ) {
    // Parameter validation
    if (owners.length != ownerPubKeys.length) {
      throw new Error("owner length does not match public keys");
    }
    if (threshold <= 0) {
      throw new Error("threshold must be greater than 0");
    }
    if (threshold > owners.length) {
      throw new Error("threshold is bigger than number of owners");
    }
    if (hasDuplicateAddresses(owners)) {
      throw new Error("has duplicate addresses");
    }
    if (owners.length > MAX_NUM_OWNERS) {
      throw new Error(`momentum safe supports up to ${MAX_NUM_OWNERS} owners`);
    }
    
    // Computing multisig address
    [this.rawPublicKey, , this.address] = computeMultiSigAddress(ownerPubKeys, threshold, creationNonce);
  }
}
```

### Creating from User Request

```typescript
static async fromUserRequest(
  owners: HexString[],
  threshold: number,
  initBalance: bigint,
): Promise<CreationHelper> {
  // Get public keys from registry
  const pubKeys = await CreationHelper.getPublicKeysFromRegistry(owners);
  // Get nonce for creation
  const creationNonce = await CreationHelper.getNonce(owners[0]);
  // Format addresses
  owners = owners.map(owner => formatAddress(owner));
  return new CreationHelper(owners, pubKeys, threshold, creationNonce, initBalance);
}

private static async getPublicKeysFromRegistry(addrs: HexString[]) {
  return Promise.all(
    addrs.map(addr => Registry.getRegisteredPublicKey(addr))
  );
}
```

### Wallet Creation Initialization

```typescript
async initCreation(signer: Account, multiOption: Options, singleOption: Options) {
  // Check that creation is not already initiated
  let creation: MomentumSafeCreation | undefined;
  try {
    creation = await this.getResourceData();
  } catch (e) {
    if (e instanceof Error && e.message.includes("Table Item not found")) {
      // Expected behavior - no creation data yet
    } else {
      throw e;
    }
  }
  if (creation) {
    throw new Error("Momentum Safe already initiated creation");
  }

  // Sign multisig transaction
  const txArg = { metadata: 'Momentum Safe' };
  const tx = await makeMSafeRegisterTx(this, txArg, multiOption);
  const [payload, sig] = signer.getSigData(tx);

  // Create and send initialization transaction
  const tx2 = await this.makeInitCreationTxn(signer, payload, sig, singleOption);
  const signedTx2 = signer.sign(tx2);

  return await Aptos.sendSignedTransactionAsync(signedTx2);
}
```

### Creating Initialization Transaction

```typescript
private async makeInitCreationTxn(
  signer: Account,
  payload: TxnBuilderTypes.SigningMessage,
  signature: TxnBuilderTypes.Ed25519Signature,
  opts?: Options,
) {
  if (!this.initBalance) {
    throw new Error("init balance not specified for init creation");
  }
  const config = await applyDefaultOptions(signer.address(), opts);
  const txBuilder = new AptosEntryTxnBuilder();
  return txBuilder
    .addr(DEPLOYER)
    .module(MODULES.CREATOR)
    .method(FUNCTIONS.CREATOR_INIT_WALLET)
    .from(signer.address())
    .withTxConfig(config)
    .args([
      serializeOwners(this.owners),
      BCS.bcsSerializeU8(this.threshold),
      BCS.bcsSerializeUint64(this.initBalance),
      BCS.bcsSerializeBytes(payload as Uint8Array),
      BCS.bcsToBytes(signature),
    ])
    .build(signer.account);
}
```

## Signing Wallet Creation

After wallet creation initialization, other owners must sign the transaction.

### Checking Readiness for Execution

```typescript
async isReadyToSubmit(extraPubKey?: HexString) {
  const creation = await this.getResourceData();
  const sigs = creation.txn.signatures;
  const msHelper = new MultiSigHelper(this.ownerPubKeys, sigs);
  let collectedSigs = sigs.data.length;

  // Consider additional signature if provided
  if (extraPubKey) {
    if (!msHelper.isSigSubmitted(extraPubKey)) {
      collectedSigs = collectedSigs + 1;
    }
  }
  return collectedSigs >= this.threshold;
}
```

### Submitting Signature

```typescript
async submitSignature(signer: Account, opts: Options) {
  const creation = await this.getResourceData();
  const sig = this.signPendingCreation(signer, creation);

  const tx = await this.makeSubmitSignatureTxn(signer, sig, opts);

  const signedTx = signer.sign(tx);
  return await Aptos.sendSignedTransactionAsync(signedTx);
}

private signPendingCreation(
  signer: Account,
  creation: MomentumSafeCreation
): TxnBuilderTypes.Ed25519Signature {
  const payload = Transaction.deserialize(HexBuffer(creation.txn.payload));
  const [, sig] = signer.getSigData(payload);
  return sig;
}
```

### Creating Signature Transaction

```typescript
private async makeSubmitSignatureTxn(signer: Account, sig: TxnBuilderTypes.Ed25519Signature, opts: Options) {
  const txModuleBuilder = new AptosEntryTxnBuilder();
  const pkIndex = this.findPkIndex(signer.publicKey());
  const config = await applyDefaultOptions(signer.address(), opts);

  return txModuleBuilder
    .addr(DEPLOYER)
    .module(MODULES.CREATOR)
    .method(FUNCTIONS.CREATOR_SUBMIT_SIG)
    .from(signer.address())
    .withTxConfig(config)
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
      BCS.bcsSerializeU8(pkIndex),
      BCS.bcsToBytes(sig),
    ])
    .build(signer.account);
}
```

### Assembling and Submitting Final Transaction

```typescript
async assembleAndSubmitTx(acc: Account) {
  const creation = await CreationHelper.getMSafeCreation(this.address);
  const signatures = creation.txn.signatures;
  const payload = creation.txn.payload;

  const extraSig = this.signPendingCreation(acc, creation);

  const multiSignature = assembleMultiSig(this.ownerPubKeys, signatures, acc, extraSig);
  const bcsTx = assembleMultiSigTxn(payload, this.rawPublicKey, multiSignature);

  return await Aptos.sendSignedTransactionAsync(bcsTx);
}
```

## Depositing Funds

After creating a multisig wallet, you can fund it with a regular APT transfer:

### Deposit Example

```typescript
// Regular APT transfer to multisig wallet address
const depositAmount = 1000000000n; // 10 APT (in micro-APT)
const msafeAddress = "0x..."; // multisig wallet address

const txBuilder = new AptosCoinTransferTxnBuilder();
const tx = await txBuilder
  .from(senderAccount.address())
  .to(HexString.ensure(msafeAddress))
  .amount(depositAmount)
  .build(senderAccount.account);

const signedTx = senderAccount.sign(tx);
await Aptos.sendSignedTransactionAsync(signedTx);
```

## Creating and Signing Transactions

### MomentumSafe Class

```typescript
// src/momentum-safe/momentum-safe.ts
export class MomentumSafe {
  owners: HexString[];
  ownersPublicKeys: HexString[];
  threshold: number;
  creationNonce: bigint;
  rawPublicKey: TxnBuilderTypes.MultiEd25519PublicKey;
  address: HexString;

  static async fromMomentumSafe(address: HexString): Promise<MomentumSafe> {
    address = formatAddress(address);
    const msafeData = await MomentumSafe.queryMSafeResource(address);
    const owners = msafeData.info.owners.map((ownerStr) =>
      HexString.ensure(ownerStr)
    );
    const threshold = msafeData.info.threshold;
    const nonce = BigInt(msafeData.info.nonce);
    const ownerPubKeys = msafeData.info.public_keys.map((pk) =>
      HexString.ensure(pk)
    );
    return new MomentumSafe(owners, ownerPubKeys, threshold, nonce, address);
  }
}
```

### Transaction Initialization

```typescript
async initTransaction(signer: Account, tx: MSafeTransaction, opts: Options) {
  const [rawTx, sig] = signer.getSigData(tx);
  const tmpHash = sha3_256(rawTx);

  const initTx = await this.makeInitTxTx(signer, rawTx, sig, opts);
  const signedInitTx = signer.sign(initTx);

  const txRes = await Aptos.sendSignedTransactionAsync(signedInitTx);
  return { plHash: tmpHash, pendingTx: txRes };
}
```

### Creating Initialization Transaction

```typescript
private async makeInitTxTx(
  signer: Account,
  payload: TxnBuilderTypes.SigningMessage,
  signature: TxnBuilderTypes.Ed25519Signature,
  opts: Options
) {
  const txBuilder = new AptosEntryTxnBuilder();
  const pkIndex = this.getIndex(signer.publicKey());
  const config = await applyDefaultOptions(signer.address(), opts);

  return txBuilder
    .addr(DEPLOYER)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_INIT_TRANSACTION)
    .from(signer.address())
    .withTxConfig(config)
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
      BCS.bcsSerializeU8(pkIndex),
      BCS.bcsSerializeBytes(payload),
      BCS.bcsToBytes(signature),
    ])
    .build(signer.account);
}
```

### Transaction Signing

```typescript
async submitTxSignature(signer: Account, txHash: string, opts: Options) {
  const txType = await this.findTx(txHash);
  const sig = this.signTx(signer, txType);

  const tx = await this.makeSubmitSignatureTxn(
    signer,
    txHash,
    txType,
    sig,
    opts
  );
  const signedTx = signer.sign(tx);
  return await Aptos.sendSignedTransactionAsync(signedTx);
}

signTx(signer: Account, txType: TransactionType) {
  const payload = HexBuffer(txType.payload);
  const tx = TypeMessage.isTypeMessage(payload)
    ? TypeMessage.deserialize(payload)
    : Transaction.deserialize(payload);
  const [, sig] = signer.getSigData(tx);
  return sig;
}
```

### Creating Signature Transaction

```typescript
async makeSubmitSignatureTxn(
  signer: Account,
  txHash: string,
  tx: TransactionType,
  sig: TxnBuilderTypes.Ed25519Signature,
  opts: Options
) {
  const pkIndex = this.getIndex(signer.publicKey());
  const txBuilder = new AptosEntryTxnBuilder();
  const config = await applyDefaultOptions(signer.address(), opts);

  return txBuilder
    .addr(DEPLOYER)
    .module(MODULES.MOMENTUM_SAFE)
    .method(FUNCTIONS.MSAFE_SUBMIT_SIGNATURE)
    .from(signer.address())
    .withTxConfig(config)
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(this.address)),
      BCS.bcsSerializeU8(pkIndex),
      BCS.bcsSerializeBytes(HexBuffer(txHash)),
      BCS.bcsToBytes(sig),
    ])
    .build(signer.account);
}
```

### Assembling and Executing Transaction

```typescript
async assembleAndSubmitTx(signer: Account, txHash: HexString | string) {
  const txType = await this.findTx(txHash);
  const payload = txType.payload;
  const signatures = txType.signatures;
  const selfSignature = this.signTx(signer, txType);
  const multiSignature = assembleMultiSig(
    this.ownersPublicKeys,
    signatures,
    signer,
    selfSignature
  );

  if (MigrationProofMessage.isMigrationProofMessage(HexBuffer(payload))) {
    // Special handling for migration
    const signingTx = await makeMigrateTxBuilder(multiSignature, this);
    const transaction = await signingTx.build(Aptos.MY_ACCOUNT.account);
    const signedTransaction = Aptos.MY_ACCOUNT.sign(transaction);
    return await Aptos.sendSignedTransactionAsync(signedTransaction);
  } else {
    const bcsTxn = assembleMultiSigTxn(
      payload,
      this.rawPublicKey,
      multiSignature
    );
    return await Aptos.sendSignedTransactionAsync(bcsTxn);
  }
}
```

## Withdrawing Funds

### Creating APT Transfer Transaction

```typescript
// src/momentum-safe/msafe-txn.ts
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

export type APTTransferArgs = {
  to: HexString;
  amount: bigint;
};
```

### Creating Any Coin Transfer Transaction

```typescript
export async function makeMSafeAnyCoinTransferTx(
  sender: IMultiSig,
  args: CoinTransferArgs,
  opts?: Options
): Promise<MSafeTransaction> {
  const config = await applyDefaultOptions(sender.address, opts);
  const txBuilder = new AptosEntryTxnBuilder();
  const structTag = typeTagStructFromName(args.coinType);

  const tx = await txBuilder
    .addr(APTOS_FRAMEWORK_HS)
    .module(MODULES.COIN)
    .method(FUNCTIONS.COIN_TRANSFER)
    .from(sender.address)
    .withTxConfig(config)
    .type_args([structTag])
    .args([
      BCS.bcsToBytes(TxnBuilderTypes.AccountAddress.fromHex(args.to)),
      BCS.bcsSerializeUint64(args.amount),
    ])
    .build(sender);

  return new MSafeTransaction(tx.raw);
}

export type CoinTransferArgs = {
  coinType: string;
  to: HexString;
  amount: bigint;
};
```

## Code Examples

### Complete Multisig Wallet Creation Example

```typescript
import { HexString } from "aptos";
import { Account } from "./src/web3/account";
import { CreationHelper } from "./src/momentum-safe/creation";
import { Registry } from "./src/momentum-safe/registry";
import * as Aptos from "./src/web3/global";

async function createMultisigWallet() {
  // Environment setup
  await Aptos.setGlobal({
    nodeURL: "https://fullnode.devnet.aptoslabs.com",
    faucetURL: "https://faucet.devnet.aptoslabs.com",
    privateKey: "0x...",
    address: "0x...",
    network: "devnet",
    msafe: HexString.ensure("0x...")
  });

  // Create owner accounts
  const owner1 = new Account(); // initiator
  const owner2 = new Account();
  const owner3 = new Account();

  const owners = [owner1.address(), owner2.address(), owner3.address()];
  const threshold = 2; // requires 2 out of 3 signatures
  const initBalance = 100000000n; // 1 APT for gas

  // 1. Register all owners in registry
  console.log("Registering owners...");
  
  for (const owner of [owner1, owner2, owner3]) {
    const isRegistered = await Registry.isRegistered(owner.address());
    if (!isRegistered) {
      const regTx = await Registry.register(owner);
      await Aptos.waitForTransaction(regTx.hash);
      console.log(`Owner ${owner.address()} registered`);
    }
  }

  // 2. Create multisig wallet
  console.log("Creating multisig wallet...");
  
  const creation = await CreationHelper.fromUserRequest(owners, threshold, initBalance);
  console.log(`Multisig wallet address: ${creation.address}`);

  // 3. Initialize creation (owner1)
  const initTx = await creation.initCreation(owner1, {
    estimateGasPrice: true,
    estimateMaxGas: true,
  }, {
    estimateGasPrice: true,
    estimateMaxGas: true,
  });
  await Aptos.waitForTransaction(initTx.hash);
  console.log("Creation initiated");

  // 4. Sign by other owners
  for (const owner of [owner2, owner3]) {
    const isReady = await creation.isReadyToSubmit(owner.publicKey());
    if (!isReady) {
      const sigTx = await creation.submitSignature(owner, {
        estimateGasPrice: true,
        estimateMaxGas: true,
      });
      await Aptos.waitForTransaction(sigTx.hash);
      console.log(`Signature from ${owner.address()} submitted`);
    }
  }

  // 5. Check readiness and execute
  const isReadyToExecute = await creation.isReadyToSubmit();
  if (isReadyToExecute) {
    const executeTx = await creation.assembleAndSubmitTx(owner1);
    await Aptos.waitForTransaction(executeTx.hash);
    console.log("Multisig wallet created!");
  }

  return creation.address;
}
```

### Transfer from Multisig Wallet Example

```typescript
import { MomentumSafe } from "./src/momentum-safe/momentum-safe";
import { makeMSafeAPTTransferTx } from "./src/momentum-safe/msafe-txn";

async function transferFromMultisig() {
  const msafeAddress = HexString.ensure("0x..."); // multisig wallet address
  const recipient = HexString.ensure("0x..."); // recipient address
  const amount = 500000000n; // 5 APT

  // Load multisig wallet
  const msafe = await MomentumSafe.fromMomentumSafe(msafeAddress);
  
  // Get next sequence number
  const sn = await msafe.getNextSN();

  // Create transfer transaction
  const transferTx = await makeMSafeAPTTransferTx(msafe, {
    to: recipient,
    amount: amount
  }, {
    sequenceNumber: sn,
    estimateGasPrice: true,
    estimateMaxGas: true,
  });

  // 1. Initiate transaction (first owner)
  const owner1 = new Account(/* owner 1 private key */);
  const { plHash: txHash, pendingTx } = await msafe.initTransaction(owner1, transferTx, {
    estimateGasPrice: true,
    estimateMaxGas: true,
  });
  await Aptos.waitForTransaction(pendingTx.hash);
  console.log(`Transaction initiated: ${txHash}`);

  // 2. Sign by other owners
  const owner2 = new Account(/* owner 2 private key */);
  
  const isReady = await msafe.isReadyToSubmit(txHash, owner2.publicKey());
  if (!isReady) {
    const sigTx = await msafe.submitTxSignature(owner2, txHash.toString(), {
      estimateGasPrice: true,
      estimateMaxGas: true,
    });
    await Aptos.waitForTransaction(sigTx.hash);
    console.log("Signature submitted");
  }

  // 3. Check readiness and execute
  const readyToExecute = await msafe.isReadyToSubmit(txHash);
  if (readyToExecute) {
    const executeTx = await msafe.assembleAndSubmitTx(owner1, txHash);
    await Aptos.waitForTransaction(executeTx.hash);
    console.log("Transfer completed!");
  }
}
```

### CLI Usage Example

```bash
# Start CLI
yarn start

# Follow interactive instructions:
# 1. Select "Create MSafe"
# 2. Specify number of owners (2-32)
# 3. Specify signature threshold
# 4. Specify initial balance
# 5. Enter other owners' addresses
# 6. Confirm creation

# For working with existing wallet:
# 1. Select wallet from list
# 2. Select "New transaction"
# 3. Choose transaction type:
#    - Transfer APT
#    - Transfer COIN
#    - Register COIN
#    - Entry function
#    - Module publish
# 4. Follow instructions to fill parameters
```

### Module Deployment Example

```typescript
import { makeModulePublishTx } from "./src/momentum-safe/msafe-txn";

async function deployModule() {
  const msafeAddress = HexString.ensure("0x...");
  const msafe = await MomentumSafe.fromMomentumSafe(msafeAddress);
  
  const sn = await msafe.getNextSN();
  
  // Create module deployment transaction
  const deployTx = await makeModulePublishTx(msafe, {
    moveDir: "./my-module" // path to directory with Move.toml
  }, {
    sequenceNumber: sn,
    estimateGasPrice: true,
    estimateMaxGas: true,
  });

  // Signing process is similar to fund transfer
  // ...
}
```

### Data Structures

```typescript
// Multisig wallet information
export type MomentumSafeInfo = {
  owners: HexString[];           // owner addresses
  pubKeys: HexString[];          // owner public keys
  creationNonce: number;         // creation nonce
  threshold: number;             // signature threshold
  curSN: bigint;                // current sequence number
  nextSN: bigint;               // next sequence number
  metadata: string;             // metadata
  balance: bigint;              // balance in micro-APT
  pendingTxs: MSafeTxnInfo[];   // pending transactions
  address: HexString;           // wallet address
  status: MSafeStatus;          // wallet status
};

// Transaction information
export type MSafeTxnInfo = {
  txType: MSafeTxnType;         // transaction type
  hash: HexString;              // transaction hash
  sender: HexString;            // sender
  sn: bigint;                   // sequence number
  expiration: Date;             // expiration time
  chainID: number;              // network ID
  gasPrice: bigint;             // gas price
  maxGas: bigint;               // max gas
  args: payloadInfo;            // transaction arguments
  numSigs?: number;             // number of signatures
};
```

## Conclusion

Momentum Safe provides a reliable multisig wallet system for Aptos with support for:

- **Flexible Configuration** - from 1/N to N/N signatures
- **Various Transaction Types** - transfers, module deployment, function calls
- **Security** - all operations require multiple signatures
- **Convenient CLI** - interactive interface for all operations
- **Programmatic API** - full integration into applications

The system provides a high level of security for managing cryptocurrency assets and executing critical operations on the Aptos blockchain.
