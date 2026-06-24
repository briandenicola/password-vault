function credentialsApi() {
  const nav = globalThis.navigator;
  if (!nav || !nav.credentials) {
    throw new Error('WebAuthn is not available in this browser.');
  }
  return nav.credentials;
}

export async function createCredential(options) {
  return credentialsApi().create(options);
}

export async function getCredential(options) {
  return credentialsApi().get(options);
}
