import { AptosClient, HexString, Types } from "aptos";

const NETWORK_ENDPOINTS = {
    Mainnet: "https://rpc.mainnet.aptos.fernlabs.xyz/v1",
    Devnet: "https://fullnode.devnet.aptoslabs.com/v1",
    Testnet: "https://fullnode.testnet.aptoslabs.com/v1",
};

const client = new AptosClient(NETWORK_ENDPOINTS.Mainnet);

async function getAccountModule(addr: HexString, moduleName: string):Promise<Types.MoveModuleBytecode> {
    return await client.getAccountModule(addr, moduleName);
}

export async function getFunctionABI(
    contract: HexString,
    moduleName: string,
    fnName: string
): Promise<Types.MoveFunction> {
    const moduleData = await getAccountModule(contract, moduleName);
    if (!moduleData.abi) {
        throw new Error(`${contract}::${moduleName} has no ABI exposed`);
    }
    if (!moduleData.abi.exposed_functions) {
        throw new Error(`${contract}::${moduleName} has no exposed function`);
    }
    const abi = moduleData.abi.exposed_functions.find((fn) => fn.name === fnName);
    if (!abi) {
        throw new Error(`${contract}::${moduleName}::${fnName} not found`);
    }
    return abi;
}

export function RPCClient():AptosClient{
    return client;
}