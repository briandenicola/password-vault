import * as msal from "@azure/msal-browser";

// MSAL v5 requires an explicit, awaited `initialize()` before any other call, and the
// redirect response must be processed (handleRedirectPromise) before the app decides
// whether the user is signed in. The previous implementation kicked these off at module
// load without awaiting them, so on the initial page load (and on the redirect back from
// Entra) the app could mount before the account was known -- the long-standing
// "does not handle initial page load properly" bug (UI-3). We now memoize a single
// initialization promise and require callers to await it.

const msalConfig = {
  auth: {
    clientId: import.meta.env.VUE_APP_AAD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${import.meta.env.VUE_APP_AAD_TENANT_ID}`,
    redirectUri: resolveRedirectUri(),
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

export function resolveRedirectUri() {
  if (typeof window !== "undefined" && window.location && window.location.origin) {
    return window.location.origin;
  }
  return import.meta.env.VUE_APP_AAD_REDIRECT_URL;
}

// Sentinel thrown by getTokenRedirect (and propagated through getBearerToken) when
// interactive authentication has been initiated via a browser redirect. Callers --
// notably the Axios interceptor -- must suppress request errors while this is in
// flight; the page will reload once authentication completes.
export class RedirectInProgressError extends Error {
  constructor() {
    super('redirect_in_progress');
    this.name = 'RedirectInProgressError';
  }
}

// Injectable for tests; defaults to a real PublicClientApplication.
let authService = new msal.PublicClientApplication(msalConfig);
let initialization = null;

// The last signed-in username, kept across an idle lock (which clears MSAL's token cache)
// so the next interactive sign-in can send login_hint. With a hint and a live Entra session,
// Entra completes sign-in without showing the account picker. An explicit sign-out forgets it
// so another family member can sign in on a shared device.
const LAST_USER_KEY = 'vault.auth.lastUser';

function storage() {
  try {
    return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
  } catch {
    return null;
  }
}

function rememberUser(username) {
  try {
    if (username) storage()?.setItem(LAST_USER_KEY, username);
  } catch { /* storage unavailable -- hint is best-effort */ }
}

function forgetUser() {
  try {
    storage()?.removeItem(LAST_USER_KEY);
  } catch { /* storage unavailable */ }
}

function loginHint() {
  const account = authService.getActiveAccount();
  if (account && account.username) {
    return account.username;
  }
  try {
    return storage()?.getItem(LAST_USER_KEY) || undefined;
  } catch {
    return undefined;
  }
}

function withLoginHint(request) {
  const hint = loginHint();
  return hint ? { ...request, loginHint: hint } : { ...request };
}

function scopes(...values) {
  return values.filter(value => typeof value === 'string' && value.trim().length > 0);
}

function applyActiveAccount(redirectResponse) {
  if (redirectResponse && redirectResponse.account) {
    authService.setActiveAccount(redirectResponse.account);
  } else if (!authService.getActiveAccount()) {
    const accounts = authService.getAllAccounts();
    if (accounts && accounts.length > 0) {
      authService.setActiveAccount(accounts[0]);
    }
  }
  const active = authService.getActiveAccount();
  if (active) {
    rememberUser(active.username);
  }
}

function ensureInitialized() {
  if (!initialization) {
    initialization = (async () => {
      try {
        await authService.initialize();
        let redirectResponse = null;
        try {
          redirectResponse = await authService.handleRedirectPromise();
        } catch (error) {
          // A failed or stale redirect response must never block app bootstrap.
          console.error('MSAL handleRedirectPromise failed:', error);
        }
        applyActiveAccount(redirectResponse);
      } catch (error) {
        console.error('MSAL initialization failed:', error);
      }
    })();
  }
  return initialization;
}

// Returns true when MSAL signals that an interactive flow is already running.
// This occurs when acquireTokenRedirect or loginRedirect is called while the
// browser is already navigating to the identity provider, or when MSAL holds
// a stale in-progress marker. Treating this as "redirect in progress" prevents
// a spurious error from surfacing while authentication is underway.
function isInteractionInProgressError(error) {
  return (
    error instanceof msal.BrowserAuthError &&
    error.errorCode === msal.BrowserAuthErrorCodes.interactionInProgress
  );
}

// MSAL sometimes reports an expired session as a hidden-iframe timeout
// (BrowserAuthError "timed_out", aka monitor_window_timeout) rather than an
// InteractionRequiredAuthError -- notably once the refresh token's lifetime
// (e.g. 24 hours) has lapsed and there is no AAD session left to silently
// renew against. Treat it the same as InteractionRequiredAuthError so the
// user is redirected to sign in again instead of seeing a raw error.
function requiresInteraction(error) {
  return (
    error instanceof msal.InteractionRequiredAuthError ||
    (error instanceof msal.BrowserAuthError &&
      error.errorCode === msal.BrowserAuthErrorCodes.timedOut)
  );
}

const api = {
  tokenRequest: {
    scopes: scopes(import.meta.env.VUE_APP_AAD_SCOPE),
  },

  loginRequest: {
    scopes: scopes("User.Read", import.meta.env.VUE_APP_AAD_SCOPE),
  },

  // Awaitable bootstrap. Safe to call multiple times; work happens once.
  async initialize() {
    await ensureInitialized();
  },

  isAuthenticated() {
    return authService.getActiveAccount() !== null;
  },

  getUserProfile() {
    const account = authService.getActiveAccount();
    return account ? account.username : "";
  },

  async signIn() {
    await ensureInitialized();
    await authService.loginRedirect(withLoginHint(this.loginRequest));
  },

  // Explicit sign-out: ends the Entra session and forgets the remembered username.
  async signOut() {
    await ensureInitialized();
    forgetUser();
    await authService.logoutRedirect({ account: authService.getActiveAccount() });
  },

  // Idle lock: drop this app's cached tokens and account WITHOUT ending the Entra session.
  // Unlocking requires a fresh sign-in redirect, but with the remembered login_hint and a
  // live Entra session that completes without an account picker or password prompt.
  async lockSession() {
    await ensureInitialized();
    const account = authService.getActiveAccount();
    await authService.clearCache(account ? { account } : undefined);
    authService.setActiveAccount(null);
  },

  async getTokenRedirect(request) {
    await ensureInitialized();
    const account = authService.getActiveAccount();

    if (!account) {
      // No cached account -- initiate login and signal that a redirect is in-flight.
      // Callers must not surface an error while browser navigation is pending.
      try {
        await authService.loginRedirect(withLoginHint(this.loginRequest));
      } catch (err) {
        if (isInteractionInProgressError(err)) {
          // A redirect is already underway -- suppress.
          throw new RedirectInProgressError();
        }
        console.error('MSAL loginRedirect failed:', err);
        throw err;
      }
      throw new RedirectInProgressError();
    }

    try {
      // Use cached access/refresh tokens only. SPA refresh tokens expire after a fixed 24h;
      // MSAL's default policy then tries a hidden-iframe renewal, which browsers that block
      // third-party cookies (Safari, Firefox, installed PWAs) make fail only after a ~10s
      // timeout. Failing fast and going straight to a top-level redirect (where Entra's
      // cookies are first-party) is both quicker and more reliable.
      return await authService.acquireTokenSilent({
        ...request,
        account,
        cacheLookupPolicy: msal.CacheLookupPolicy.AccessTokenAndRefreshToken,
      });
    } catch (error) {
      if (requiresInteraction(error)) {
        // Token requires user interaction (expired RT, consent, timed-out
        // silent renewal, etc.).
        // Initiate redirect and signal the caller to suppress errors. login_hint lets
        // Entra complete it without UI while its session is still alive.
        try {
          await authService.acquireTokenRedirect(withLoginHint({ ...request, account }));
          // acquireTokenRedirect resolves before browser navigation completes;
          // throw the sentinel so the Axios interceptor suppresses the request.
          throw new RedirectInProgressError();
        } catch (redirectError) {
          if (redirectError instanceof RedirectInProgressError) {
            throw redirectError;
          }
          if (isInteractionInProgressError(redirectError)) {
            // MSAL already has a redirect in progress -- suppress.
            throw new RedirectInProgressError();
          }
          // Genuine failure to initiate the redirect -- log and surface it.
          console.error('MSAL acquireTokenRedirect failed:', redirectError);
          throw redirectError;
        }
      }
      // Non-recoverable silent acquisition failure -- propagate as-is.
      // This covers network errors, configuration problems, and programming
      // errors; do not attempt interactive auth for these conditions.
      throw error;
    }
  },

  async getBearerToken() {
    const response = await this.getTokenRedirect(this.tokenRequest);
    if (response === null || response === undefined) {
      return null;
    }
    return response.accessToken;
  },

  // Test seam: swap the underlying MSAL instance and reset memoized init state.
  _setAuthService(instance) {
    authService = instance;
    initialization = null;
  },
};

export default api;
