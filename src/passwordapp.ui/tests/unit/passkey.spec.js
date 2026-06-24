import { describe, it, expect } from 'vitest';
import {
  bufferToBase64Url,
  base64UrlToBytes,
  isPrfMaybeSupported,
  buildEnrollOptions,
  buildUnlockOptions,
  extractPrfSecret,
} from '@/components/crypto/passkey.js';

describe('base64url', () => {
  it('round-trips bytes (url-safe, unpadded)', () => {
    const bytes = new Uint8Array([251, 239, 190, 0, 1, 2, 3]);
    const s = bufferToBase64Url(bytes);
    expect(s).not.toMatch(/[+/=]/);
    expect([...base64UrlToBytes(s)]).toEqual([...bytes]);
  });
});

describe('isPrfMaybeSupported', () => {
  it('returns a boolean (false in the node test env without WebAuthn)', () => {
    expect(typeof isPrfMaybeSupported()).toBe('boolean');
  });
});

describe('buildEnrollOptions', () => {
  const prfSalt = new Uint8Array(32).fill(1);

  it('places the PRF salt under extensions.prf.eval.first', () => {
    const opts = buildEnrollOptions({
      rpId: 'vault.example',
      rpName: 'Vault',
      userId: new Uint8Array([1, 2, 3]),
      userName: 'brian',
      prfSalt,
    });
    expect(opts.publicKey.extensions.prf.eval.first).toBe(prfSalt);
    expect(opts.publicKey.rp.id).toBe('vault.example');
    expect(opts.publicKey.authenticatorSelection.userVerification).toBe('required');
    expect(opts.publicKey.pubKeyCredParams.some(p => p.alg === -7)).toBe(true);
    expect(opts.publicKey.challenge).toBeInstanceOf(Uint8Array);
  });

  it('throws without a prfSalt', () => {
    expect(() => buildEnrollOptions({ rpId: 'x', userName: 'y' })).toThrow();
  });
});

describe('buildUnlockOptions', () => {
  const prfSalt = new Uint8Array(32).fill(2);

  it('maps base64url allowCredentials to byte ids and sets the PRF salt', () => {
    const id = bufferToBase64Url(new Uint8Array([9, 8, 7]));
    const opts = buildUnlockOptions({ rpId: 'vault.example', prfSalt, allowCredentials: [id] });
    expect(opts.publicKey.extensions.prf.eval.first).toBe(prfSalt);
    expect(opts.publicKey.allowCredentials[0].type).toBe('public-key');
    expect([...opts.publicKey.allowCredentials[0].id]).toEqual([9, 8, 7]);
  });

  it('throws without a prfSalt', () => {
    expect(() => buildUnlockOptions({ rpId: 'x' })).toThrow();
  });
});

describe('extractPrfSecret', () => {
  it('extracts the first PRF result as bytes', () => {
    const credential = {
      getClientExtensionResults: () => ({ prf: { results: { first: new Uint8Array([5, 6, 7]).buffer } } }),
    };
    expect([...extractPrfSecret(credential)]).toEqual([5, 6, 7]);
  });

  it('throws a clear error when no PRF result is present', () => {
    const credential = { getClientExtensionResults: () => ({}) };
    expect(() => extractPrfSecret(credential)).toThrow(/PRF/);
  });

  it('throws when the credential has no extension results accessor', () => {
    expect(() => extractPrfSecret({})).toThrow(/PRF/);
  });
});
