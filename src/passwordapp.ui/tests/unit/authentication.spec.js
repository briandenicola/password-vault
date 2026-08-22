import { describe, it, expect, beforeEach } from 'vitest';
import { InteractionRequiredAuthError, BrowserAuthError, BrowserAuthErrorCodes } from '@azure/msal-browser';
import Authentication, { resolveRedirectUri, RedirectInProgressError } from '@/components/azuread/AzureAD.Authentication.js';

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
    loginRedirect: overrides.loginRedirect || (async () => { calls.push('loginRedirect'); }),
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
    await Authentication.getBearerToken().catch(() => {}); // may throw RedirectInProgressError — ignore
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

  it('triggers login redirect and throws RedirectInProgressError when there is no account', async () => {
    const fake = makeFakeMsal();
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    expect(Authentication.isAuthenticated()).toBe(false);
    expect(Authentication.getUserProfile()).toBe('');
    await expect(Authentication.getBearerToken()).rejects.toThrow(RedirectInProgressError);
    expect(fake.calls).toContain('loginRedirect');
  });

  it('uses the runtime browser origin for redirect URLs', () => {
    const originalWindow = global.window;
    global.window = { location: { origin: 'https://vault.example.com' } };

    try {
      expect(resolveRedirectUri()).toBe('https://vault.example.com');
    } finally {
      global.window = originalWindow;
    }
  });

  it('falls back to the configured redirect URL outside a browser', () => {
    const originalWindow = global.window;
    const originalRedirectUrl = process.env.VUE_APP_AAD_REDIRECT_URL;
    delete global.window;
    process.env.VUE_APP_AAD_REDIRECT_URL = 'https://gray-hill-03b055310.7.azurestaticapps.net';

    try {
      expect(resolveRedirectUri()).toBe('https://gray-hill-03b055310.7.azurestaticapps.net');
    } finally {
      global.window = originalWindow;
      process.env.VUE_APP_AAD_REDIRECT_URL = originalRedirectUrl;
    }
  });

  it('returns a silently-acquired bearer token for the active account', async () => {
    const account = { username: 'parent@example.com' };
    Authentication._setAuthService(makeFakeMsal({ redirectResponse: { account } }));
    await Authentication.initialize();
    await expect(Authentication.getBearerToken()).resolves.toBe('silent-token');
  });

  it('falls back to interactive redirect and signals redirect-in-progress when silent acquisition requires interaction', async () => {
    const account = { username: 'parent@example.com' };
    const fake = makeFakeMsal({
      redirectResponse: { account },
      acquireTokenSilent: async () => { throw new InteractionRequiredAuthError(); },
    });
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    await expect(Authentication.getBearerToken()).rejects.toThrow(RedirectInProgressError);
    expect(fake.calls).toContain('acquireTokenRedirect');
  });

  it('falls back to interactive redirect when silent acquisition times out (expired refresh token)', async () => {
    // Reproduces briandenicola/password-vault#68: once the refresh token's 24h
    // lifetime lapses, MSAL can report a hidden-iframe "timed_out" BrowserAuthError
    // rather than InteractionRequiredAuthError. This must also fall back to redirect.
    const account = { username: 'parent@example.com' };
    const timedOutError = new BrowserAuthError(BrowserAuthErrorCodes.timedOut, 'test');
    const fake = makeFakeMsal({
      redirectResponse: { account },
      acquireTokenSilent: async () => { throw timedOutError; },
    });
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    await expect(Authentication.getBearerToken()).rejects.toThrow(RedirectInProgressError);
    expect(fake.calls).toContain('acquireTokenRedirect');
  });

  it('propagates non-recoverable silent acquisition failures without attempting interactive auth', async () => {
    const account = { username: 'parent@example.com' };
    const networkError = new Error('network failure');
    const fake = makeFakeMsal({
      redirectResponse: { account },
      acquireTokenSilent: async () => { throw networkError; },
    });
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    await expect(Authentication.getBearerToken()).rejects.toThrow('network failure');
    expect(fake.calls).not.toContain('acquireTokenRedirect');
  });

  it('throws RedirectInProgressError when acquireTokenRedirect reports an interaction already in progress', async () => {
    const account = { username: 'parent@example.com' };
    const inProgressError = new BrowserAuthError(BrowserAuthErrorCodes.interactionInProgress, 'test');
    const fake = makeFakeMsal({
      redirectResponse: { account },
      acquireTokenSilent: async () => { throw new InteractionRequiredAuthError(); },
      acquireTokenRedirect: async () => { throw inProgressError; },
    });
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    await expect(Authentication.getBearerToken()).rejects.toThrow(RedirectInProgressError);
  });

  it('surfaces genuine redirect initiation failures so they remain visible', async () => {
    const account = { username: 'parent@example.com' };
    const configError = new Error('MSAL config error');
    const fake = makeFakeMsal({
      redirectResponse: { account },
      acquireTokenSilent: async () => { throw new InteractionRequiredAuthError(); },
      acquireTokenRedirect: async () => { throw configError; },
    });
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    await expect(Authentication.getBearerToken()).rejects.toThrow('MSAL config error');
  });

  it('throws RedirectInProgressError when loginRedirect reports an interaction already in progress', async () => {
    const inProgressError = new BrowserAuthError(BrowserAuthErrorCodes.interactionInProgress, 'test');
    const fake = makeFakeMsal({
      loginRedirect: async () => { throw inProgressError; },
    });
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    await expect(Authentication.getBearerToken()).rejects.toThrow(RedirectInProgressError);
  });

  it('surfaces genuine loginRedirect failures when no account is cached', async () => {
    const configError = new Error('MSAL config error');
    const fake = makeFakeMsal({
      loginRedirect: async () => { throw configError; },
    });
    Authentication._setAuthService(fake);
    await Authentication.initialize();
    await expect(Authentication.getBearerToken()).rejects.toThrow('MSAL config error');
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
