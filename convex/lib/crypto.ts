/**
 * AES-256-GCM encryption/decryption helpers for Stripe secrets.
 *
 * Uses the Web Crypto API (crypto.subtle), available in both Convex actions
 * and Node.js ≥ 15. The master key is a 64-char hex string (32 bytes).
 *
 * Storage format: "{iv_hex}:{ciphertext_hex}"
 */

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const buf = new ArrayBuffer(hex.length / 2);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function importKey(keyHex: string): Promise<CryptoKey> {
  if (keyHex.length !== 64) {
    throw new Error("STRIPE_MASTER_KEY must be exactly 64 hex characters (32 bytes).");
  }
  const raw = hexToBytes(keyHex);
  return crypto.subtle.importKey("raw", raw.buffer, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns a string in the format "{iv_hex}:{ciphertext_hex}".
 */
export async function encryptSecret(
  plaintext: string,
  masterKeyHex: string
): Promise<string> {
  const key = await importKey(masterKeyHex);
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12))); // 96-bit IV
  const encoded = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  return `${bytesToHex(iv)}:${bytesToHex(new Uint8Array(ciphertext))}`;
}

/**
 * Decrypts a string produced by encryptSecret.
 */
export async function decryptSecret(
  encrypted: string,
  masterKeyHex: string
): Promise<string> {
  const colonIdx = encrypted.indexOf(":");
  if (colonIdx === -1) throw new Error("Invalid encrypted secret format.");
  const ivHex = encrypted.slice(0, colonIdx);
  const ctHex = encrypted.slice(colonIdx + 1);
  const key = await importKey(masterKeyHex);
  const iv = hexToBytes(ivHex);
  const ct = hexToBytes(ctHex);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ct
  );
  return new TextDecoder().decode(plaintext);
}

/**
 * Checks whether a string looks like an encrypted secret
 * (i.e. contains the ":" separator and the IV is 24 hex chars = 12 bytes).
 */
export function isEncrypted(value: string): boolean {
  const colonIdx = value.indexOf(":");
  if (colonIdx !== 24) return false; // IV is always 12 bytes = 24 hex chars
  return /^[0-9a-f]+:[0-9a-f]+$/.test(value);
}
