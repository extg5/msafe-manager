/**
 * Utility functions for working with transaction signatures
 */

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
