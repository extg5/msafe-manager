/**
 * Utility functions for working with transaction signatures
 */

import { HexString, TxnBuilderTypes, BCS } from "aptos"
import { HexBuffer } from "./transaction"

export interface ExtractedSignature {
  variant: number
  pubkey: Uint8Array
  signature: Uint8Array
}

/**
 * Extracts signature, public key, and variant from a signed transaction
 * @param signedBytes - The signed transaction bytes
 * @returns Object containing variant, pubkey, and signature
 */
export const extractSigFromSignedTx = (signedBytes: Uint8Array | number[]): ExtractedSignature => {
  const bytes = signedBytes instanceof Uint8Array ? signedBytes : new Uint8Array(signedBytes)
  if (bytes.length < 1 + 1 + 32 + 1 + 64) throw new Error("SignedTransaction too short")

  const sigLen = bytes[bytes.length - 65]
  if (sigLen !== 0x40) throw new Error(`Unexpected signature length tag: 0x${sigLen.toString(16)}`)
  const signature = bytes.slice(bytes.length - 64)

  const pkLenIdx = bytes.length - 65 - 33
  const pkLen = bytes[pkLenIdx]
  if (pkLen !== 0x20) throw new Error(`Unexpected pubkey length tag: 0x${pkLen.toString(16)}`)
  const pubkey = bytes.slice(pkLenIdx + 1, pkLenIdx + 1 + 32)

  const variant = bytes[pkLenIdx - 1]
  if (variant !== 0x00) {
    throw new Error(`Unsupported authenticator variant: 0x${variant.toString(16)}`)
  }

  return { variant, pubkey, signature }
}

/**
 * Converts bytes to hex string
 * @param bytes - The bytes to convert
 * @returns Hex string representation
 */
export const toHex = (bytes: Uint8Array): string => {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
}
function noncePubKey(nonce: number) {
  const pubKey = Buffer.alloc(TxnBuilderTypes.Ed25519PublicKey.LENGTH);
  const deployerBuf = HexBuffer('0xaa90e0d9d16b63ba4a289fb0dc8d1b454058b21c9b5c76864f825d5c1f32582e'); //msafe mainnet address
  deployerBuf.copy(pubKey, 0, 0, 16);
  pubKey.writeUInt32LE(nonce, 16);
  return new TxnBuilderTypes.Ed25519PublicKey(pubKey);
}

function parsePubKey(publicKey: string | Uint8Array | HexString): TxnBuilderTypes.Ed25519PublicKey {
  let pkBytes: BCS.Bytes;
  if (typeof publicKey === 'string') {
    pkBytes = HexString.ensure(publicKey).toUint8Array();
  } else if (publicKey instanceof HexString) {
    pkBytes = publicKey.toUint8Array();
  } else {
    pkBytes = publicKey;
  }
  return new TxnBuilderTypes.Ed25519PublicKey(pkBytes);
}

const IMPORT_NONCE = BigInt('0xffffffffffffffff');
export function computeMultiSigAddress(owners: string[] | Uint8Array[] | HexString[], threshold: number, nonce: bigint):
  [TxnBuilderTypes.MultiEd25519PublicKey, HexString, HexString] {

  const publicKeys: TxnBuilderTypes.Ed25519PublicKey[] = owners.map( (owner) => {
    return parsePubKey(owner);
  });
  if(nonce !== IMPORT_NONCE) {
    publicKeys.push(noncePubKey(Number(nonce)));
  }
  const multiPubKey = new TxnBuilderTypes.MultiEd25519PublicKey(
    publicKeys, threshold,
  );
  const authKey = TxnBuilderTypes.AuthenticationKey.fromMultiEd25519PublicKey(
    multiPubKey
  );
  return [
    multiPubKey,
    HexString.fromUint8Array(multiPubKey.toBytes()),
    authKey.derivedAddress()
  ];
}

export function hex2a(hex: string): string {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  
  // Convert hex string to array of bytes
  const bytes = new Uint8Array(
    cleanHex.match(/.{1,2}/g)?.map(byte => parseInt(byte, 16)) || []
  );

  // Decode bytes to string using TextDecoder
  return new TextDecoder().decode(bytes);
}
