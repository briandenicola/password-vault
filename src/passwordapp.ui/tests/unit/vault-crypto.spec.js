import { describe, it, expect } from 'vitest';
import {
  V2_GCM_PREFIX,
  toBase64,
  fromBase64,
  generateDekBytes,
  importAesGcmKey,
  serializeEnvelope,
  parseEnvelope,
  encryptSecret,
  decryptSecret,
  encryptBytes,
  decryptBytes,
} from '@/components/crypto/vault-crypto.js';

describe('base64 helpers', () => {
  it('round-trips arbitrary bytes', () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128, 64]);
    expect([...fromBase64(toBase64(bytes))]).toEqual([...bytes]);
  });
});

describe('AES-GCM secret round-trip', () => {
  async function freshKey() {
    return importAesGcmKey(generateDekBytes(), { extractable: false });
  }

  it('encrypts then decrypts an ASCII string', async () => {
    const key = await freshKey();
    const env = await encryptSecret(key, 'correct horse battery staple');
    expect(env.startsWith(V2_GCM_PREFIX)).toBe(true);
    expect(await decryptSecret(key, env)).toBe('correct horse battery staple');
  });

  it('handles non-ASCII / unicode (the CR-1 corruption class)', async () => {
    const key = await freshKey();
    const secret = 'pÄsswörd—🌍—日本語';
    expect(await decryptSecret(key, await encryptSecret(key, secret))).toBe(secret);
  });

  it('produces a unique IV per encryption (different ciphertext for same input)', async () => {
    const key = await freshKey();
    const a = await encryptSecret(key, 'same');
    const b = await encryptSecret(key, 'same');
    expect(a).not.toBe(b);
  });

  it('rejects a tampered ciphertext (auth tag failure)', async () => {
    const key = await freshKey();
    const env = await encryptSecret(key, 'secret');
    const { iv, ct } = parseEnvelope(env);
    ct[0] ^= 0x01;
    const tampered = serializeEnvelope(iv, ct);
    await expect(decryptSecret(key, tampered)).rejects.toThrow();
  });

  it('rejects decryption under the wrong key', async () => {
    const k1 = await freshKey();
    const k2 = await freshKey();
    const env = await encryptSecret(k1, 'secret');
    await expect(decryptSecret(k2, env)).rejects.toThrow();
  });

  it('round-trips raw bytes via encryptBytes/decryptBytes', async () => {
    const key = await freshKey();
    const bytes = generateDekBytes();
    const out = await decryptBytes(key, await encryptBytes(key, bytes));
    expect([...out]).toEqual([...bytes]);
  });
});

describe('envelope parsing', () => {
  it('throws on a non-v2 blob', () => {
    expect(() => parseEnvelope('hmacB64:cipherB64')).toThrow();
    expect(() => parseEnvelope('')).toThrow();
    expect(() => parseEnvelope(null)).toThrow();
  });

  it('throws on a malformed v2 blob', () => {
    expect(() => parseEnvelope('v2.gcm.onlythree')).toThrow();
    expect(() => parseEnvelope('v2.gcm..ct')).toThrow();
    expect(() => parseEnvelope('v2.gcm.iv.')).toThrow();
  });

  it('serialize/parse are inverse', () => {
    const iv = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const ct = new Uint8Array([9, 8, 7, 6, 5]);
    const { iv: iv2, ct: ct2 } = parseEnvelope(serializeEnvelope(iv, ct));
    expect([...iv2]).toEqual([...iv]);
    expect([...ct2]).toEqual([...ct]);
  });
});
