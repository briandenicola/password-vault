// OFF-4 (E2EE) — the per-vault key record. See docs/design/e2ee.md §5B.
//
// One record per vault, stored server-side. It holds only NON-secret material:
// the PRF input salt and, for each enrolled unlock factor (passkey or recovery
// key), a *wrapped* copy of the DEK. The server never sees the DEK or any KEK.
//
//   { prfSalt: "<base64>",
//     wrappedDeks: [ { credentialId, label, wrapped }, ... ] }

import { toBase64, fromBase64 } from './vault-crypto.js';
import { unwrapDek } from './dek.js';

export const RECOVERY_CREDENTIAL_ID = 'recovery-key';
const PRF_SALT_BYTES = 32;

// Random, non-secret per-vault PRF input salt.
export function generatePrfSalt() {
  return globalThis.crypto.getRandomValues(new Uint8Array(PRF_SALT_BYTES));
}

// Create an empty record for a new vault from raw salt bytes.
export function createVaultKeyRecord(prfSaltBytes) {
  return { prfSalt: toBase64(prfSaltBytes), wrappedDeks: [] };
}

// The PRF salt as raw bytes (to feed deriveKek).
export function getPrfSaltBytes(record) {
  validateRecord(record);
  return fromBase64(record.prfSalt);
}

export function findWrappedDek(record, credentialId) {
  validateRecord(record);
  return record.wrappedDeks.find(w => w.credentialId === credentialId) || null;
}

// Add (or replace, by credentialId) a wrapped DEK. Returns a NEW record; the
// input is not mutated.
export function addWrappedDek(record, { credentialId, label, wrapped }) {
  validateRecord(record);
  if (!credentialId || !wrapped) {
    throw new Error('addWrappedDek requires credentialId and wrapped.');
  }
  const entry = { credentialId, label: label || credentialId, wrapped };
  const wrappedDeks = record.wrappedDeks.filter(w => w.credentialId !== credentialId);
  wrappedDeks.push(entry);
  return { ...record, wrappedDeks };
}

// Remove a wrapped DEK by credentialId. Returns a NEW record.
export function removeWrappedDek(record, credentialId) {
  validateRecord(record);
  return { ...record, wrappedDeks: record.wrappedDeks.filter(w => w.credentialId !== credentialId) };
}

// Unwrap the DEK for a specific enrolled factor with its KEK. Returns raw DEK
// bytes, or throws if the factor is unknown or the KEK is wrong.
export async function unwrapWithKek(record, credentialId, kek) {
  const entry = findWrappedDek(record, credentialId);
  if (!entry) {
    throw new Error(`No wrapped DEK for credential '${credentialId}'.`);
  }
  return unwrapDek(kek, entry.wrapped);
}

// Try to unwrap the DEK against every enrolled factor with the given KEK. Useful
// for the recovery-key path where the matching entry isn't known up front.
// Returns raw DEK bytes, or throws if none unwrap.
export async function tryUnwrapAny(record, kek) {
  validateRecord(record);
  for (const entry of record.wrappedDeks) {
    try {
      return await unwrapDek(kek, entry.wrapped);
    } catch {
      // wrong KEK for this entry — keep trying.
    }
  }
  throw new Error('No enrolled factor could be unwrapped with this key.');
}

// Serialize for storage / send to the server.
export function serializeRecord(record) {
  validateRecord(record);
  return JSON.stringify(record);
}

// Parse + validate a record received from storage.
export function parseRecord(json) {
  const record = typeof json === 'string' ? JSON.parse(json) : json;
  validateRecord(record);
  return record;
}

export function validateRecord(record) {
  if (!record || typeof record !== 'object') {
    throw new Error('Vault key record must be an object.');
  }
  if (typeof record.prfSalt !== 'string' || record.prfSalt.length === 0) {
    throw new Error('Vault key record is missing prfSalt.');
  }
  if (!Array.isArray(record.wrappedDeks)) {
    throw new Error('Vault key record wrappedDeks must be an array.');
  }
  for (const w of record.wrappedDeks) {
    if (!w || typeof w.credentialId !== 'string' || typeof w.wrapped !== 'string') {
      throw new Error('Each wrappedDek needs a credentialId and wrapped string.');
    }
  }
  return record;
}
