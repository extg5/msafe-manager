import { WebAccount } from "../lib/WebAccount";
export declare const WALLET_TYPE: {
    readonly PONTEM: "Pontem";
    readonly MARTIAN: "Martian";
    readonly FEWCHA: "Fewcha";
    readonly PETRA: "Petra";
    readonly RISE: "Rise";
    readonly Onekey: "Onekey";
    readonly OKX: "Okx";
};
export declare type WalletType = typeof WALLET_TYPE[keyof typeof WALLET_TYPE];
declare type Connectors = {
    [k in WalletType]: () => Promise<WebAccount>;
};
export declare const WalletConnectors: Connectors;
export {};
