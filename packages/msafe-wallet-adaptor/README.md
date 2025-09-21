# Msafe Wallet Adaptor

## Installation
`yarn`

## Implment new WebAccount
There are two main interfaces need to be implemented: `wallet` and `walletSignTxnImpl`.

### `wallet` interface
Interface: `abstract wallet: any;`.

`wallet` is a getter, that return the injected wallet, like `window.pontem`:
```typescript
get wallet() {
    return window.pontem;
}
```

### `walletSignTxnImpl` interface
Interface: `abstract walletSignTxnImpl(txn: TxnBuilderTypes.RawTransaction):Promise<TxnBuilderTypes.SignedTransaction>;`

`walletSignTxnImpl` is a async function that is used to sign a transaction. It accepts an unsigned transaction and expects to return a signed transaction.

If the new wallet can sign `TxnBuilderTypes.RawTransaction` directly, please check the implements: [Fewcha] and [Martian].  
If the new wallet sign transaction with `payload` and `option` like below, 
please check [Pontem].
```typescript
const payload = {
  function: "0x1::coin::transfer",
  type_arguments: ["0x1::aptos_coin::AptosCoin"],
  arguments: ["0xeb442855143ce3e26babc6152ad98e9da7db7f0820f08be3d006535b663a6292", "1000"]
};
const options = {
  max_gas_amount: '1000',
  gas_unit_price: '1',
  expiration_timestamp_secs: '1646793600',
  sequence_number: '10'
}
```

[Petra] is still in continuous integration and is not yet available.


[Fewcha]: ./src/adaptors/FewchaAccount.ts
[Martian]: ./src/adaptors/MartianAccount.ts
[Pontem]: ./src/adaptors/PontemAccount.ts
[Petra]: ./src/adaptors/PetraAccount.ts