import { AptosClient, HexString, Types } from "aptos";
export declare function getFunctionABI(contract: HexString, moduleName: string, fnName: string): Promise<Types.MoveFunction>;
export declare function RPCClient(): AptosClient;
