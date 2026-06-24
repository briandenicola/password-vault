import { describe, it, expect, beforeEach, vi } from 'vitest';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import Authentication from '@/components/azuread/AzureAD.Authentication.js';

// A fake PublicClientApplication that records call ordering so we can prove that
// initialize() and handleRedirectPromise() are awaited before the app inspects accounts
// (the UI-3 "initial page load" bug) and that token acquisition is account-gated (UI-6).
function makeFakeMsal(overrides = {}) {
  const calls = [];
  let activeAccount = null;
  const accounts = overrides.accounts || [];

  return {
    calls,
    async initialize() { calls.push('initialize'); },
    async handleRedirectPromise() {
      calls.push('handleRedirectPromise');
      return overrides.redirectResponse ?? null;
    },
    getAllAccounts() { return accounts; },
    getActiveAccount() { return activeAccount; },
    setActiveAccount(a) { activeAccount = a; calls.push('setActiveAccount'); },
    async loginRedirect() { calls.push('loginRedirect'); },
    async logoutRedirect(req) { calls.push('logoutRedirect'); this.lastLogout = req; },
    acquireTokenSilent: overrides.acquireTokenSilent
      || (async () => ({ accessToken: 'silent-token' })),
    acquireTokenRedirect: overrides.acquireTokenRedirect
      || (async () => { calls.push('acquireTokenRedirect'); }),
  };
}

describe('AzureAD.Authentication (MSAL v5)', () => {
  beforeEach(() => {
    // Default: no session.
    Authentication._setAuthService(makeFakeMsal());
  });

  it('initializes MSAL and processes the redirect before resolving', async () => {
    const fake = makeFakeMsal();
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    expect(fake.calls).toEqual(['initialize', 'handleRedirectPromise']);
  });

  it('initializes only once across repeated calls', async () => {
    const fake = makeFakeMsal();
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    await Authentication.initialize();
    await Authentication.getBearerToken();
    expect(fake.calls.filter(c => c === 'initialize')).toHaveLength(1);
  });

  it('adopts the account from the redirect response (sign-in return path)', async () => {
    const account = { username: 'parent@example.com' };
    Authentication._setAuthService(makeFakeMsal({ redirectResponse: { account } }));
    await Authentication.initialize();
    expect(Authentication.isAuthenticated()).toBe(true);
    expect(Authentication.getUserProfile()).toBe('parent@example.com');
  });

  it('adopts an existing cached account when there is no redirect response', async () => {
    const account = { username: 'cached@example.com' };
    Authentication._setAuthService(makeFakeMsal({ accounts: [account] }));
    await Authentication.initialize();
    expect(Authentication.isAuthenticated()).toBe(true);
    expect(Authentication.getUserProfile()).toBe('cached@example.com');
  });

  it('reports unauthenticated and a null token when there is no account', async () => {
    Authentication._setAuthService(makeFakeMsal());
    await Authentication.initialize();
    expect(Authentication.isAuthenticated()).toBe(false);
    expect(Authentication.getUserProfile()).toBe('');
    await expect(Authentication.getBearerToken()).resolves.toBeNull();
  });

  it('returns a silently-acquired bearer token for the active account', async () => {
    const account = { username: 'parent@example.com' };
    Authentication._setAuthService(makeFakeMsal({ redirectResponse: { account } }));
    await Authentication.initialize();
    await expect(Authentication.getBearerToken()).resolves.toBe('silent-token');
  });

  it('falls back to an interactive redirect when silent acquisition needs interaction', async () => {
    const account = { username: 'parent@example.com' };
    const fake = makeFakeMsal({
      redirectResponse: { account },
      acquireTokenSilent: async () => { throw new InteractionRequiredAuthError(); },
    });
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    const token = await Authentication.getBearerToken();
    expect(token).toBeNull();
    expect(fake.calls).toContain('acquireTokenRedirect');
  });

  it('signs out using the active account', async () => {
    const account = { username: 'parent@example.com' };
    const fake = makeFakeMsal({ redirectResponse: { account } });
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    await Authentication.signOut();
    expect(fake.lastLogout).toEqual({ account });
  });

  it('still resolves init (so the app can mount) when handleRedirectPromise rejects', async () => {
    // Reproduces the no_token_request_cache_error path: a stale/failed redirect must
    // not block bootstrap. The cached account should still be adopted.
    const account = { username: 'cached@example.com' };
    const fake = makeFakeMsal({ accounts: [account] });
    fake.handleRedirectPromise = async () => { throw new Error('no_token_request_cache_error'); };
    Authentication._setAuthService(fake);
    await expect(Authentication.initialize()).resolves.toBeUndefined();
    expect(Authentication.isAuthenticated()).toBe(true);
    expect(Authentication.getUserProfile()).toBe('cached@example.com');
  });
});
