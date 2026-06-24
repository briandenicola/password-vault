// OFF-4 (E2EE) — WebAuthn passkey + PRF helpers. See docs/design/e2ee.md §4.
//
// The pure parts here (feature detection, option builders, PRF extraction,
// base64url) are unit-tested. The actual ceremony wrappers (`enrollPasskey` /
// `unlockPasskey`) just call navigator.credentials and delegate to the pure
// helpers; they need real authenticator hardware to exercise and are therefore
// NOT unit-tested and NOT yet wired into the app (Phase 1). Treat them as
// scaffolding pending on-device validation.

// --- base64url (WebAuthn ids are raw ArrayBuffers) ---

export function bufferToBase64Url(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(b64url) {
  const b64 = String(b64url).replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const bin = atob(b64 + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

// --- feature detection ---

// Best-effort: WebAuthn presence can be detected synchronously, but PRF support
// can only be *confirmed* by performing a ceremony and checking the result
// (hence "maybe"). Enrollment must verify a real PRF result before relying on it.
export function isPrfMaybeSupported() {
  return typeof globalThis.PublicKeyCredential !== 'undefined'
    && typeof globalThis.navigator !== 'undefined'
    && !!globalThis.navigator.credentials;
}

// 32 random bytes for a WebAuthn challenge.
export function generateChallenge() {
  return globalThis.crypto.getRandomValues(new Uint8Array(32));
}

// --- option builders (pure) ---

// Build navigator.credentials.create() options that enroll a new encryption
// passkey and request its PRF output for `prfSalt` in one ceremony.
export function buildEnrollOptions({ rpId, rpName, userId, userName, displayName, prfSalt, challenge }) {
  if (!prfSalt) {
    throw new Error('buildEnrollOptions requires prfSalt.');
  }
  return {
    publicKey: {
      challenge: challenge || generateChallenge(),
      rp: { id: rpId, name: rpName || 'Password Vault' },
      user: {
        id: userId,
        name: userName,
        displayName: displayName || userName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },    // ES256
        { type: 'public-key', alg: -257 },  // RS256
      ],
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
      },
      timeout: 60000,
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  };
}

// Build navigator.credentials.get() options that unlock by evaluating the PRF
// for `prfSalt` on an already-enrolled passkey.
export function buildUnlockOptions({ rpId, prfSalt, challenge, allowCredentials = [] }) {
  if (!prfSalt) {
    throw new Error('buildUnlockOptions requires prfSalt.');
  }
  return {
    publicKey: {
      challenge: challenge || generateChallenge(),
      rpId,
      allowCredentials: allowCredentials.map(id => ({
        type: 'public-key',
        id: typeof id === 'string' ? base64UrlToBytes(id) : id,
      })),
      userVerification: 'required',
      timeout: 60000,
      extensions: { prf: { eval: { first: prfSalt } } },
    },
  };
}

// Extract the 32-byte PRF secret from a credential's client extension results.
// Throws a clear error when the authenticator/browser returned no PRF result.
export function extractPrfSecret(credential) {
  const ext = credential && typeof credential.getClientExtensionResults === 'function'
    ? credential.getClientExtensionResults()
    : null;
  const first = ext && ext.prf && ext.prf.results && ext.prf.results.first;
  if (!first) {
    throw new Error('Passkey returned no PRF result; this authenticator or browser does not support the PRF extension.');
  }
  return new Uint8Array(first);
}

// --- ceremony wrappers (NOT unit-tested; need real hardware; not yet wired) ---

export async function enrollPasskey(options) {
  const credential = await globalThis.navigator.credentials.create(options);
  return {
    credentialId: bufferToBase64Url(credential.rawId),
    prfSecret: extractPrfSecret(credential),
  };
}

export async function unlockPasskey(options) {
  const credential = await globalThis.navigator.credentials.get(options);
  return {
    credentialId: bufferToBase64Url(credential.rawId),
    prfSecret: extractPrfSecret(credential),
  };
}
