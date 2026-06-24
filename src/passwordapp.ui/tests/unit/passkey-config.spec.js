import { describe, it, expect } from 'vitest';
import { DEFAULT_RP_ID, getRpId, getRpName } from '@/components/crypto/passkey-config.js';

describe('passkey RP config', () => {
  it('defaults the WebAuthn RP ID to the registrable production domain', () => {
    expect(DEFAULT_RP_ID).toBe('denicolafamily.com');
    expect(getRpId({})).toBe('denicolafamily.com');
  });

  it('allows VUE_APP_RP_ID override for local/manual testing', () => {
    expect(getRpId({ VUE_APP_RP_ID: 'localhost' })).toBe('localhost');
  });

  it('uses a stable RP name', () => {
    expect(getRpName()).toMatch(/Password Vault/);
  });
});
