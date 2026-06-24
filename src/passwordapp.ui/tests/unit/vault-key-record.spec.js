import { describe, it, expect } from 'vitest';
import {
  generatePrfSalt,
  createVaultKeyRecord,
  getPrfSaltBytes,
  addWrappedDek,
  removeWrappedDek,
  findWrappedDek,
  unwrapWithKek,
  tryUnwrapAny,
  serializeRecord,
  parseRecord,
  validateRecord,
  RECOVERY_CREDENTIAL_ID,
} from '@/components/crypto/vault-key-record.js';
import { generateDek, deriveKek, wrapDek } from '@/components/crypto/dek.js';

describe('vault key record', () => {
  it('creates an empty record carrying the PRF salt', () => {
    const prfSalt = generatePrfSalt();
    const rec = createVaultKeyRecord(prfSalt);
    expect(rec.wrappedDeks).toEqual([]);
    expect([...getPrfSaltBytes(rec)]).toEqual([...prfSalt]);
  });

  it('adds wrapped DEKs immutably and finds them', () => {
    const rec0 = createVaultKeyRecord(generatePrfSalt());
    const rec1 = addWrappedDek(rec0, { credentialId: 'cred-a', label: 'Phone', wrapped: 'AAA' });
    expect(rec0.wrappedDeks).toHaveLength(0); // original untouched
    expect(rec1.wrappedDeks).toHaveLength(1);
    expect(findWrappedDek(rec1, 'cred-a').label).toBe('Phone');
    expect(findWrappedDek(rec1, 'missing')).toBeNull();
  });

  it('replaces (not duplicates) a wrapped DEK with the same credentialId', () => {
    let rec = createVaultKeyRecord(generatePrfSalt());
    rec = addWrappedDek(rec, { credentialId: 'cred-a', wrapped: 'OLD' });
    rec = addWrappedDek(rec, { credentialId: 'cred-a', wrapped: 'NEW' });
    expect(rec.wrappedDeks).toHaveLength(1);
    expect(findWrappedDek(rec, 'cred-a').wrapped).toBe('NEW');
  });

  it('removes a wrapped DEK', () => {
    let rec = createVaultKeyRecord(generatePrfSalt());
    rec = addWrappedDek(rec, { credentialId: 'cred-a', wrapped: 'AAA' });
    rec = removeWrappedDek(rec, 'cred-a');
    expect(rec.wrappedDeks).toHaveLength(0);
  });

  it('serialize/parse round-trips and validates', () => {
    let rec = createVaultKeyRecord(generatePrfSalt());
    rec = addWrappedDek(rec, { credentialId: 'cred-a', wrapped: 'AAA' });
    const parsed = parseRecord(serializeRecord(rec));
    expect(parsed).toEqual(rec);
  });

  it('rejects malformed records', () => {
    expect(() => validateRecord(null)).toThrow();
    expect(() => validateRecord({})).toThrow();
    expect(() => validateRecord({ prfSalt: 'x' })).toThrow();
    expect(() => validateRecord({ prfSalt: 'x', wrappedDeks: [{ label: 'no-id' }] })).toThrow();
  });
});

describe('vault key record + real crypto (end-to-end envelope)', () => {
  it('unwraps the DEK for a specific enrolled factor', async () => {
    const prfSalt = generatePrfSalt();
    let rec = createVaultKeyRecord(prfSalt);
    const { bytes: dek } = await generateDek();

    const kek = await deriveKek(new Uint8Array(32).fill(11), getPrfSaltBytes(rec));
    rec = addWrappedDek(rec, { credentialId: 'phone', label: 'Phone', wrapped: await wrapDek(kek, dek) });

    expect([...(await unwrapWithKek(rec, 'phone', kek))]).toEqual([...dek]);
  });

  it('supports multiple factors (passkey + recovery) wrapping the same DEK', async () => {
    let rec = createVaultKeyRecord(generatePrfSalt());
    const saltBytes = getPrfSaltBytes(rec);
    const { bytes: dek } = await generateDek();

    const passkeyKek = await deriveKek(new Uint8Array(32).fill(1), saltBytes);
    const recoveryKek = await deriveKek(new Uint8Array(32).fill(2), saltBytes);
    rec = addWrappedDek(rec, { credentialId: 'phone', wrapped: await wrapDek(passkeyKek, dek) });
    rec = addWrappedDek(rec, { credentialId: RECOVERY_CREDENTIAL_ID, wrapped: await wrapDek(recoveryKek, dek) });

    // Either factor recovers the same DEK.
    expect([...(await unwrapWithKek(rec, 'phone', passkeyKek))]).toEqual([...dek]);
    expect([...(await tryUnwrapAny(rec, recoveryKek))]).toEqual([...dek]);
  });

  it('tryUnwrapAny throws when no factor matches', async () => {
    let rec = createVaultKeyRecord(generatePrfSalt());
    const saltBytes = getPrfSaltBytes(rec);
    const { bytes: dek } = await generateDek();
    const realKek = await deriveKek(new Uint8Array(32).fill(1), saltBytes);
    const wrongKek = await deriveKek(new Uint8Array(32).fill(9), saltBytes);
    rec = addWrappedDek(rec, { credentialId: 'phone', wrapped: await wrapDek(realKek, dek) });
    await expect(tryUnwrapAny(rec, wrongKek)).rejects.toThrow();
  });
});
