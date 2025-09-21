import { PontemAccount } from "./PontemAccount";
import { MartianAccount } from "./MartianAccount";
import { FewchaAccount } from "./FewchaAccount";
import { PetraAccount } from "./PetraAccount";
import { RiseAccount } from "./RiseAccount";
import { OnekeyAccount } from "./OnekeyAccount";
import { OkxAccount } from "./OkxAccounts";
export const WALLET_TYPE = {
    PONTEM: "Pontem",
    MARTIAN: "Martian",
    FEWCHA: "Fewcha",
    PETRA: "Petra",
    RISE: "Rise",
    Onekey: "Onekey",
    OKX: "Okx",
};
export const WalletConnectors = {
    [WALLET_TYPE.PONTEM]: async () => {
        const account = await window.pontem.connect();
        return new PontemAccount(account.address, account.publicKey);
    },
    [WALLET_TYPE.MARTIAN]: async () => {
        const account = await window.martian.connect();
        return new MartianAccount(account.address, account.publicKey);
    },
    [WALLET_TYPE.FEWCHA]: async () => {
        const account = await window.fewcha.connect().then((r) => r.data);
        return new FewchaAccount(account.address, account.publicKey);
    },
    [WALLET_TYPE.PETRA]: async () => {
        const account = await window.petra.connect();
        return new PetraAccount(account.address, account.publicKey);
    },
    [WALLET_TYPE.RISE]: async () => {
        const account = await window.rise.connect();
        return new RiseAccount(account.address, account.publicKey);
    },
    [WALLET_TYPE.Onekey]: async () => {
        const account = await window.$onekey.aptos.connect();
        return new OnekeyAccount(account.address, account.publicKey);
    },
    [WALLET_TYPE.OKX]: async () => {
        const account = await window.okxwallet.aptos.connect();
        return new OkxAccount(account.address, account.publicKey);
    },
};
//# sourceMappingURL=Connector.js.map