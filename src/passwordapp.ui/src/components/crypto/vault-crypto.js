// OFF-4 (E2EE) — symmetric layer. Pure Web Crypto AES-GCM encrypt/decrypt of a
// single secret under a Data Encryption Key (DEK), plus the versioned on-disk
// envelope. See docs/design/e2ee.md §3 and §5.
//
// The envelope string is *format-compatible* with the server's SecretEnvelope
// v2 ("v2.gcm.<ivB64>.<ciphertext+tagB64>", PasswordService.Common), so a blob
// produced here parses on the server and vice versa. (E2EE blobs are encrypted
// under the client-only DEK, so the server can store but not decrypt them — the
// read-path wiring that depends on this is a later phase, not part of Phase 1.)
//
// This module is intentionally key-source agnostic: it only deals with an
// AES-GCM CryptoKey. How that key is obtained (passkey PRF, recovery key, …)
// lives in dek.js / passkey helpers.

export const V2_GCM_PREFIX = 'v2.gcm.';
export const IV_BYTES = 12;   // 96-bit nonce, recommended for AES-GCM
export const DEK_BYTES = 32;  // 256-bit key

const subtle = () => globalThis.crypto.subtle;

// --- base64 (standard, matches .NET Convert.ToBase64String) ---

export function toBase64(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = '';
  for (let i = 0; i < arr.length; i++) {
    bin += String.fromCharCode(arr[i]);
  }
  return btoa(bin);
}

export function fromBase64(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

// --- DEK material ---

// 256-bit random key material. Returned as raw bytes so callers can both import
// it for use (non-extractable) and wrap it for storage without making the usable
// key extractable.
export function generateDekBytes() {
  return globalThis.crypto.getRandomValues(new Uint8Array(DEK_BYTES));
}

// Import raw key bytes as an AES-GCM CryptoKey. Non-extractable by default so an
// in-memory DEK can be used to encrypt/decrypt but never read back out.
export async function importAesGcmKey(rawBytes, { extractable = false } = {}) {
  return subtle().importKey('raw', rawBytes, { name: 'AES-GCM' }, extractable, ['encrypt', 'decrypt']);
}

// --- envelope ---

// Serialize an IV + ciphertext(+tag) into the canonical v2 stored form.
export function serializeEnvelope(ivBytes, ctBytes) {
  return `${V2_GCM_PREFIX}${toBase64(ivBytes)}.${toBase64(ctBytes)}`;
}

// Parse a v2.gcm envelope into its raw IV + ciphertext(+tag). Throws on anything
// that isn't a well-formed v2 blob (mirrors the server's strictness).
export function parseEnvelope(stored) {
  if (typeof stored !== 'string' || !stored.startsWith(V2_GCM_PREFIX)) {
    throw new Error('Not a v2.gcm secret envelope.');
  }
  const parts = stored.split('.');
  // ["v2", "gcm", ivB64, ctB64]
  if (parts.length !== 4 || parts[2].length === 0 || parts[3].length === 0) {
    throw new Error("Malformed v2.gcm envelope; expected 'v2.gcm.<iv>.<ciphertext+tag>'.");
  }
  return { iv: fromBase64(parts[2]), ct: fromBase64(parts[3]) };
}

// --- encrypt / decrypt ---

// Encrypt raw bytes under `key` with a fresh random IV; returns a v2 envelope.
export async function encryptBytes(key, bytes) {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, bytes));
  return serializeEnvelope(iv, ct);
}

// Decrypt a v2 envelope under `key`; returns raw bytes. AES-GCM verifies the
// auth tag and throws on tamper or wrong key.
export async function decryptBytes(key, envelope) {
  const { iv, ct } = parseEnvelope(envelope);
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv }, key, ct));
}

// Encrypt a UTF-8 string secret; returns a v2 envelope.
export async function encryptSecret(key, plaintext) {
  return encryptBytes(key, new TextEncoder().encode(String(plaintext)));
}

// Decrypt a v2 envelope to a UTF-8 string. Throws on tamper or wrong key.
export async function decryptSecret(key, envelope) {
  return new TextDecoder().decode(await decryptBytes(key, envelope));
}
