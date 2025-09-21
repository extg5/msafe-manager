import { HexString, TxnBuilderTypes, BCS, TransactionBuilder } from "aptos";
import { Account, SigData } from "./Account";
import nacl from "tweetnacl";

const toHex = (a: Uint8Array)=>HexString.fromUint8Array(a).hex();
const eq = (a: Uint8Array, b: Uint8Array) => toHex(a) === toHex(b);

// used to check if the wallet deal the input transaction in right way
const signFuncCheck = (
  target: any,
  propertyKey: string,
  descriptor: PropertyDescriptor
) => {
  const fn = descriptor.value;
  descriptor.value = async function (
    txn: TxnBuilderTypes.RawTransaction
  ): Promise<TxnBuilderTypes.SignedTransaction> {
    const signedTxn: TxnBuilderTypes.SignedTransaction = await fn.apply(this, [
      txn,
    ]);
    const serializerIn = new BCS.Serializer();
    const serializerOut = new BCS.Serializer();
    txn.serialize(serializerIn);
    signedTxn.raw_txn.serialize(serializerOut);
    const inDataHex = toHex(serializerIn.getBytes());
    const outDataHex = toHex(serializerOut.getBytes());
    let hasError = false;
    if (inDataHex !== outDataHex) {
      hasError = true;
      console.log('in bcs txn:\n', inDataHex);
      console.log('out bcs txn:\n', outDataHex);
      const outTxn = signedTxn.raw_txn;

      const check = <T>(field:string, inValue:T, outValue:T)=>{
        let inData = inValue instanceof Uint8Array ? toHex(inValue):inValue;
        let outData = outValue instanceof Uint8Array ? toHex(outValue):outValue;
        if(inData !== outData) {
          console.log(`${field} different!`);
          console.log(`\tin : ${inData}`);
          console.log(`\tout: ${outData}`);
        }
      }
      
      check('sender', txn.sender.address, outTxn.sender.address);
      check('sequence_number', txn.sequence_number, outTxn.sequence_number);
      check('payload', BCS.bcsToBytes(txn.payload), BCS.bcsToBytes(outTxn.payload));
      check('max_gas_amount', txn.max_gas_amount, outTxn.max_gas_amount);
      check('gas_unit_price', txn.gas_unit_price, outTxn.gas_unit_price);
      check('expiration_timestamp_secs', txn.expiration_timestamp_secs, outTxn.expiration_timestamp_secs);
      check('chain_id', txn.chain_id.value, outTxn.chain_id.value);
    }
    const signingMessage = TransactionBuilder.getSigningMessage(signedTxn.raw_txn);
    const authenticator =
      signedTxn.authenticator as TxnBuilderTypes.TransactionAuthenticatorEd25519;
    const signature = authenticator.signature.value;
    const publicKey = authenticator.public_key.value;
    const walletPubkey = (this as WebAccount).publicKeyBytes();
    if (!eq(publicKey, walletPubkey)) {
      hasError = true;
      console.log("Error: public key don't match");
    }
    const verified = nacl.sign.detached.verify(
      signingMessage,
      signature,
      publicKey
    );
    if (!verified) {
      console.log("Error: invalid signature!");
    }
    if(hasError) throw Error("not pass signFuncCheck");
    return signedTxn;
  };
};

export abstract class WebAccount implements Account {
  abstract wallet: any;
  abstract walletSignTxnImpl(
    txn: TxnBuilderTypes.RawTransaction
  ): Promise<TxnBuilderTypes.SignedTransaction>;

  constructor(
    public readonly _address: string,
    public readonly _publicKey: string
  ) { }

  address(): HexString {
    return new HexString(this._address);
  }

  publicKey(): HexString {
    return new HexString(this._publicKey);
  }

  publicKeyBytes(): BCS.Bytes {
    return this.publicKey().toUint8Array();
  }

  @signFuncCheck
  async walletSignTxn(
    txn: TxnBuilderTypes.RawTransaction
  ): Promise<TxnBuilderTypes.SignedTransaction> {
    return this.walletSignTxnImpl(txn);
  }

  async sign(txn: TxnBuilderTypes.RawTransaction): Promise<BCS.Bytes> {
    const signedTx = await this.walletSignTxn(txn);
    return BCS.bcsToBytes(signedTx);
  }

  async getSigData(txn: TxnBuilderTypes.RawTransaction): Promise<SigData> {
    const signedTx = await this.walletSignTxn(txn);
    const authenticator =
      signedTx.authenticator as TxnBuilderTypes.TransactionAuthenticatorEd25519;
    const signingMessage = TransactionBuilder.getSigningMessage(txn);
    const sig = authenticator.signature;
    return [signingMessage, sig];
  }
}
