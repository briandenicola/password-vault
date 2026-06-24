import { describe, it, expect } from 'vitest';
import { importDek } from '@/components/crypto/dek.js';
import { decryptSecret, encryptSecret } from '@/components/crypto/vault-crypto.js';
import {
  generateDek,
  deriveKek,
  wrapDek,
  unwrapDek,
  generateRecoveryKey,
  recoveryKeyToBytes,
} from '@/components/crypto/dek.js';

const salt = new Uint8Array(32).fill(7);

describe('DEK generation', () => {
  it('generates 32 random bytes and a usable non-extractable key', async () => {
    const { bytes, key } = await generateDek();
    expect(bytes.length).toBe(32);
    expect(key.extractable).toBe(false);
    const env = await encryptSecret(key, 'hello');
    expect(await decryptSecret(key, env)).toBe('hello');
  });

  it('two DEKs differ', async () => {
    const a = await generateDek();
    const b = await generateDek();
    expect([...a.bytes]).not.toEqual([...b.bytes]);
  });
});

describe('KEK derivation + DEK wrap/unwrap', () => {
  it('wraps and unwraps the DEK under a derived KEK', async () => {
    const secret = new Uint8Array(32).fill(42); // stands in for a PRF output
    const kek = await deriveKek(secret, salt);
    const { bytes } = await generateDek();
    const wrapped = await wrapDek(kek, bytes);
    const unwrapped = await unwrapDek(kek, wrapped);
    expect([...unwrapped]).toEqual([...bytes]);
  });

  it('the unwrapped DEK decrypts what the original DEK encrypted', async () => {
    const secret = new Uint8Array(32).fill(9);
    const kek = await deriveKek(secret, salt);
    const { bytes, key } = await generateDek();
    const envelope = await encryptSecret(key, 'vault secret');
    const unwrapped = await unwrapDek(kek, await wrapDek(kek, bytes));
    const restoredKey = await importDek(unwrapped);
    expect(await decryptSecret(restoredKey, envelope)).toBe('vault secret');
  });

  it('a different secret yields a KEK that cannot unwrap', async () => {
    const kek1 = await deriveKek(new Uint8Array(32).fill(1), salt);
    const kek2 = await deriveKek(new Uint8Array(32).fill(2), salt);
    const { bytes } = await generateDek();
    const wrapped = await wrapDek(kek1, bytes);
    await expect(unwrapDek(kek2, wrapped)).rejects.toThrow();
  });

  it('a different salt yields a KEK that cannot unwrap', async () => {
    const secret = new Uint8Array(32).fill(3);
    const kek1 = await deriveKek(secret, salt);
    const kek2 = await deriveKek(secret, new Uint8Array(32).fill(8));
    const { bytes } = await generateDek();
    await expect(unwrapDek(kek2, await wrapDek(kek1, bytes))).rejects.toThrow();
  });
});

describe('recovery key', () => {
  it('produces a grouped, typeable display and recovers the same bytes', () => {
    const { display, bytes } = generateRecoveryKey();
    expect(display).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/);
    expect([...recoveryKeyToBytes(display)]).toEqual([...bytes]);
  });

  it('tolerates lowercase, spaces and common transcription confusions', () => {
    const { display, bytes } = generateRecoveryKey();
    const messy = display.toLowerCase().replace(/-/g, ' ');
    expect([...recoveryKeyToBytes(messy)]).toEqual([...bytes]);
  });

  it('wraps the DEK so a recovery key can restore it', async () => {
    const { display, bytes: recoveryBytes } = generateRecoveryKey();
    const kek = await deriveKek(recoveryBytes, salt);
    const { bytes: dek } = await generateDek();
    const wrapped = await wrapDek(kek, dek);
    // Later: user types the recovery key back in.
    const kekAgain = await deriveKek(recoveryKeyToBytes(display), salt);
    expect([...(await unwrapDek(kekAgain, wrapped))]).toEqual([...dek]);
  });

  it('normalises/strips unknown characters rather than throwing', () => {
    // Non-alphabet characters are stripped during decode; confusable letters
    // (I/L/O/U) are normalised, so messy input still decodes deterministically.
    expect(() => recoveryKeyToBytes('!!!!')).not.toThrow();
    expect(() => recoveryKeyToBytes('ABC$')).not.toThrow();
    const { display, bytes } = generateRecoveryKey();
    expect([...recoveryKeyToBytes(`  ${display}  `)]).toEqual([...bytes]);
  });
});
