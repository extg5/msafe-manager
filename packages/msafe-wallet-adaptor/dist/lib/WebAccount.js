var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
import { HexString, BCS, TransactionBuilder } from "aptos";
import nacl from "tweetnacl";
const toHex = (a) => HexString.fromUint8Array(a).hex();
const eq = (a, b) => toHex(a) === toHex(b);
// used to check if the wallet deal the input transaction in right way
const signFuncCheck = (target, propertyKey, descriptor) => {
    const fn = descriptor.value;
    descriptor.value = async function (txn) {
        const signedTxn = await fn.apply(this, [
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
            const check = (field, inValue, outValue) => {
                let inData = inValue instanceof Uint8Array ? toHex(inValue) : inValue;
                let outData = outValue instanceof Uint8Array ? toHex(outValue) : outValue;
                if (inData !== outData) {
                    console.log(`${field} different!`);
                    console.log(`\tin : ${inData}`);
                    console.log(`\tout: ${outData}`);
                }
            };
            check('sender', txn.sender.address, outTxn.sender.address);
            check('sequence_number', txn.sequence_number, outTxn.sequence_number);
            check('payload', BCS.bcsToBytes(txn.payload), BCS.bcsToBytes(outTxn.payload));
            check('max_gas_amount', txn.max_gas_amount, outTxn.max_gas_amount);
            check('gas_unit_price', txn.gas_unit_price, outTxn.gas_unit_price);
            check('expiration_timestamp_secs', txn.expiration_timestamp_secs, outTxn.expiration_timestamp_secs);
            check('chain_id', txn.chain_id.value, outTxn.chain_id.value);
        }
        const signingMessage = TransactionBuilder.getSigningMessage(signedTxn.raw_txn);
        const authenticator = signedTxn.authenticator;
        const signature = authenticator.signature.value;
        const publicKey = authenticator.public_key.value;
        const walletPubkey = this.publicKeyBytes();
        if (!eq(publicKey, walletPubkey)) {
            hasError = true;
            console.log("Error: public key don't match");
        }
        const verified = nacl.sign.detached.verify(signingMessage, signature, publicKey);
        if (!verified) {
            console.log("Error: invalid signature!");
        }
        if (hasError)
            throw Error("not pass signFuncCheck");
        return signedTxn;
    };
};
export class WebAccount {
    constructor(_address, _publicKey) {
        this._address = _address;
        this._publicKey = _publicKey;
    }
    address() {
        return new HexString(this._address);
    }
    publicKey() {
        return new HexString(this._publicKey);
    }
    publicKeyBytes() {
        return this.publicKey().toUint8Array();
    }
    async walletSignTxn(txn) {
        return this.walletSignTxnImpl(txn);
    }
    async sign(txn) {
        const signedTx = await this.walletSignTxn(txn);
        return BCS.bcsToBytes(signedTx);
    }
    async getSigData(txn) {
        const signedTx = await this.walletSignTxn(txn);
        const authenticator = signedTx.authenticator;
        const signingMessage = TransactionBuilder.getSigningMessage(txn);
        const sig = authenticator.signature;
        return [signingMessage, sig];
    }
}
__decorate([
    signFuncCheck
], WebAccount.prototype, "walletSignTxn", null);
//# sourceMappingURL=WebAccount.js.map