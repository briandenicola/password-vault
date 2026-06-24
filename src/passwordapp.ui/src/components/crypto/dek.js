// OFF-4 (E2EE) — key management (envelope model). See docs/design/e2ee.md §4.
//
// The vault is encrypted by a single random Data Encryption Key (DEK). The DEK
// is never sent to the server; instead it is *wrapped* (encrypted) under a Key
// Encryption Key (KEK) derived from each unlock factor — a passkey's PRF output
// or a printed recovery key — and only the wrapped copies are stored.
//
// Wrapping here is AES-GCM over the raw DEK bytes (reusing the v2 envelope),
// which keeps the usable DEK non-extractable while still being storable.

import {
  generateDekBytes,
  importAesGcmKey,
  encryptBytes,
  decryptBytes,
} from './vault-crypto.js';

const subtle = () => globalThis.crypto.subtle;

// Crockford base32 (no I, L, O, U) — used for human-typeable recovery keys.
const BASE32_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const RECOVERY_BYTES = 20; // 160 bits => exactly 32 base32 chars, no padding

// --- DEK ---

// Generate a fresh DEK: raw bytes (for wrapping) plus a non-extractable AES-GCM
// CryptoKey (for use). Drop `bytes` from memory once wrapping is done.
export async function generateDek() {
  const bytes = generateDekBytes();
  const key = await importAesGcmKey(bytes, { extractable: false });
  return { bytes, key };
}

// Import previously-unwrapped raw DEK bytes as a non-extractable usable key.
export async function importDek(rawBytes) {
  return importAesGcmKey(rawBytes, { extractable: false });
}

// --- KEK derivation (HKDF) ---

// Derive a non-extractable AES-GCM KEK from secret key material (a 32-byte PRF
// output or recovery-key bytes) and the per-vault salt. `info` domain-separates
// the derivation so the same secret can't be misused elsewhere.
export async function deriveKek(secretBytes, saltBytes, info = 'password-vault:kek') {
  const ikm = await subtle().importKey('raw', secretBytes, 'HKDF', false, ['deriveKey']);
  return subtle().deriveKey(
    { name: 'HKDF', hash: 'SHA-256', salt: saltBytes, info: new TextEncoder().encode(info) },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

// --- wrap / unwrap ---

// Wrap raw DEK bytes under a KEK; returns a v2 envelope string for storage.
export async function wrapDek(kek, dekBytes) {
  return encryptBytes(kek, dekBytes);
}

// Unwrap a stored DEK envelope under a KEK; returns raw DEK bytes. Throws (auth
// tag failure) if the KEK is wrong or the blob was tampered with.
export async function unwrapDek(kek, wrapped) {
  return decryptBytes(kek, wrapped);
}

// --- recovery key ---

function base32Encode(bytes) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return out;
}

function base32Decode(str) {
  // Normalise common transcription confusions before decoding.
  const clean = String(str)
    .toUpperCase()
    .replace(/O/g, '0')
    .replace(/[IL]/g, '1')
    .replace(/U/g, 'V')
    .replace(/[^0-9A-Z]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const c of clean) {
    const idx = BASE32_ALPHABET.indexOf(c);
    if (idx === -1) {
      throw new Error('Invalid recovery key character.');
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

// Generate a printable recovery key. Returns { display, bytes } — show `display`
// to the user (grouped, e.g. "ABCD-EFGH-…"); `bytes` is the secret material fed
// to deriveKek to wrap a recovery copy of the DEK.
export function generateRecoveryKey() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(RECOVERY_BYTES));
  const display = base32Encode(bytes).match(/.{1,4}/g).join('-');
  return { display, bytes };
}

// Convert a (possibly messily-typed) recovery key back to its secret bytes.
export function recoveryKeyToBytes(display) {
  return base32Decode(display);
}
