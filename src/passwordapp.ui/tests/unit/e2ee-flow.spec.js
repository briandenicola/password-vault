import { describe, it, expect } from 'vitest';
import {
  enrollFirstPasskey,
  enrollAdditionalPasskey,
  unlockVaultWithPasskey,
  unlockVaultWithRecoveryKey,
} from '@/components/crypto/e2ee-flow.js';
import { VaultSession } from '@/components/crypto/vault-session.js';
import { encryptSecret, decryptSecret } from '@/components/crypto/vault-crypto.js';
import { RECOVERY_CREDENTIAL_ID } from '@/components/crypto/vault-key-record.js';

function credential(id, prfSecret) {
  return {
    rawId: new Uint8Array(id),
    getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array(prfSecret).buffer } } }),
  };
}

function memoryHttp(initialRecord = null) {
  let record = initialRecord;
  return {
    get record() { return record; },
    async get(url) {
      expect(url).toBe('/api/vault-key');
      if (!record) {
        const error = new Error('not found');
        error.response = { status: 404 };
        throw error;
      }
      return {
        data: {
          PrfSalt: record.prfSalt,
          WrappedDeks: record.wrappedDeks.map(w => ({
            CredentialId: w.credentialId,
            Label: w.label,
            Wrapped: w.wrapped,
          })),
        },
      };
    },
    async put(url, body) {
      expect(url).toBe('/api/vault-key');
      record = body;
      return { data: body };
    },
  };
}

function sessionRoundTrip(session) {
  return encryptSecret(session.getDek(), 'family secret')
    .then(envelope => decryptSecret(session.getDek(), envelope));
}

describe('E2EE passkey enrollment/unlock flow', () => {
  it('first enrollment creates passkey and recovery wrapped DEKs, stores the record, and unlocks', async () => {
    const http = memoryHttp();
    const session = new VaultSession();
    const result = await enrollFirstPasskey({
      label: 'Brian phone',
      userName: 'brian@example.com',
      createFn: async (options) => {
        expect(options.publicKey.rp.id).toBe('denicolafamily.com');
        expect(options.publicKey.extensions.prf.eval.first).toBeInstanceOf(Uint8Array);
        return credential([1, 2, 3], new Uint8Array(32).fill(7));
      },
      http,
      session,
    });

    expect(result.credentialId).toBe('AQID');
    expect(result.recoveryKey).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){7}$/);
    expect(http.record.wrappedDeks.map(w => w.credentialId).sort()).toEqual([RECOVERY_CREDENTIAL_ID, 'AQID'].sort());
    expect(session.isUnlocked).toBe(true);
    await expect(sessionRoundTrip(session)).resolves.toBe('family secret');
  });

  it('unlocks by passkey PRF without real WebAuthn hardware', async () => {
    const http = memoryHttp();
    const enrollingSession = new VaultSession();
    await enrollFirstPasskey({
      createFn: async () => credential([9, 9, 9], new Uint8Array(32).fill(3)),
      http,
      session: enrollingSession,
    });

    const unlockSession = new VaultSession();
    const result = await unlockVaultWithPasskey({
      getFn: async (options) => {
        expect(options.publicKey.allowCredentials[0].id).toBeInstanceOf(Uint8Array);
        return credential([9, 9, 9], new Uint8Array(32).fill(3));
      },
      http,
      session: unlockSession,
    });

    expect(result.credentialId).toBe('CQkJ');
    expect(unlockSession.isUnlocked).toBe(true);
    await expect(sessionRoundTrip(unlockSession)).resolves.toBe('family secret');
  });

  it('enrolls an additional passkey by unwrapping with an existing passkey then re-wrapping', async () => {
    const http = memoryHttp();
    await enrollFirstPasskey({
      createFn: async () => credential([1], new Uint8Array(32).fill(1)),
      http,
      session: new VaultSession(),
    });

    const result = await enrollAdditionalPasskey({
      label: 'Brian laptop',
      getFn: async () => credential([1], new Uint8Array(32).fill(1)),
      createFn: async () => credential([2], new Uint8Array(32).fill(2)),
      http,
    });

    expect(result.credentialId).toBe('Ag');
    expect(http.record.wrappedDeks.find(w => w.credentialId === 'Ag').label).toBe('Brian laptop');

    const newPasskeySession = new VaultSession();
    await unlockVaultWithPasskey({
      getFn: async () => credential([2], new Uint8Array(32).fill(2)),
      http,
      session: newPasskeySession,
    });
    expect(newPasskeySession.isUnlocked).toBe(true);
  });

  it('unlocks with the one-time recovery key copy', async () => {
    const http = memoryHttp();
    const enrolled = await enrollFirstPasskey({
      createFn: async () => credential([5], new Uint8Array(32).fill(5)),
      http,
      session: new VaultSession(),
    });

    const recoverySession = new VaultSession();
    await unlockVaultWithRecoveryKey({
      recoveryKey: enrolled.recoveryKey,
      http,
      session: recoverySession,
    });
    expect(recoverySession.isUnlocked).toBe(true);
  });
});
