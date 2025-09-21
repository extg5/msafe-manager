import { BCS, HexString, TxnBuilderTypes } from "aptos";
import { EntryFunctionTxnConvertor } from "../lib/TxnConvertor";
import { WebAccount } from "../lib/WebAccount";
// pontem need to wait they fix bug
export class PontemAccount extends WebAccount {
    get wallet() {
        return window.pontem;
    }
    async walletSignTxnImpl(txn) {
        const txnConvertor = new EntryFunctionTxnConvertor(PontemAccount.fmt);
        const payload = txn.payload;
        if (!(payload instanceof TxnBuilderTypes.TransactionPayloadEntryFunction)) {
            throw Error("only support EntryFunction");
        }
        const signingPayload = await txnConvertor.getSigningPayload(payload);
        const signingOption = txnConvertor.getSigningOption(txn);
        console.log(signingOption);
        try {
            const signedPayload = await this.wallet.signTransaction(signingPayload, signingOption);
            const deserializer = new BCS.Deserializer(signedPayload.result);
            return TxnBuilderTypes.SignedTransaction.deserialize(deserializer);
        }
        catch (e) {
            console.error(e);
            throw e;
        }
    }
    /// fmt formats the arg by abi-type to meet the wallet's parameter format.
    static fmt(type, arg) {
        switch (type) {
            case "address": // arg is Uint8Array of length 20.
                return HexString.fromUint8Array(arg).hex();
            case "u8": // arg is Number
            case "u64": // arg is BigInt
            case "u128": // arg is BigInt
                return String(arg);
            case "vector<u8>": // arg is Uint8Array of arbitrary length.
                return arg;
        }
        return arg;
    }
}
//# sourceMappingURL=PontemAccount.js.map