import { describe, it, expect } from 'vitest';
import { normalizeVaultKeyRecord, getVaultKeyRecord, putVaultKeyRecord } from '@/components/crypto/vault-key-api.js';

describe('vault-key API helper', () => {
  it('normalizes PascalCase server records to the client §5B shape', () => {
    const record = normalizeVaultKeyRecord({
      PrfSalt: btoa('salt'),
      WrappedDeks: [{ CredentialId: 'cred', Label: 'Phone', Wrapped: btoa('wrapped') }],
    });
    expect(record).toEqual({
      prfSalt: btoa('salt'),
      wrappedDeks: [{ credentialId: 'cred', label: 'Phone', wrapped: btoa('wrapped') }],
    });
  });

  it('returns null on GET 404 so the UI can show first enrollment', async () => {
    const http = {
      async get() {
        const error = new Error('missing');
        error.response = { status: 404 };
        throw error;
      },
    };
    await expect(getVaultKeyRecord(http)).resolves.toBeNull();
  });

  it('PUTs the client record to /api/vault-key', async () => {
    const sent = [];
    const record = { prfSalt: btoa('salt'), wrappedDeks: [{ credentialId: 'cred', wrapped: btoa('wrapped') }] };
    const http = {
      async put(url, body) {
        sent.push({ url, body });
        return { data: body };
      },
    };
    await expect(putVaultKeyRecord(record, http)).resolves.toEqual(record);
    expect(sent).toEqual([{ url: '/api/vault-key', body: record }]);
  });
});
