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
    clientId: process.env.VUE_APP_AAD_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${process.env.VUE_APP_AAD_TENANT_ID}`,
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
  return process.env.VUE_APP_AAD_REDIRECT_URL;
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

function scopes(...values) {
  return values.filter(value => typeof value === 'string' && value.trim().length > 0);
}

function applyActiveAccount(redirectResponse) {
  if (redirectResponse && redirectResponse.account) {
    authService.setActiveAccount(redirectResponse.account);
    return;
  }
  if (!authService.getActiveAccount()) {
    const accounts = authService.getAllAccounts();
    if (accounts && accounts.length > 0) {
      authService.setActiveAccount(accounts[0]);
    }
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
    scopes: scopes(process.env.VUE_APP_AAD_SCOPE),
  },

  loginRequest: {
    scopes: scopes("User.Read", process.env.VUE_APP_AAD_SCOPE),
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
    await authService.loginRedirect(this.loginRequest);
  },

  async signOut() {
    await ensureInitialized();
    await authService.logoutRedirect({ account: authService.getActiveAccount() });
  },

  async getTokenRedirect(request) {
    await ensureInitialized();
    const account = authService.getActiveAccount();

    if (!account) {
      // No cached account -- initiate login and signal that a redirect is in-flight.
      // Callers must not surface an error while browser navigation is pending.
      try {
        await authService.loginRedirect(this.loginRequest);
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
      return await authService.acquireTokenSilent({ ...request, account });
    } catch (error) {
      if (requiresInteraction(error)) {
        // Token requires user interaction (expired RT, consent, timed-out
        // silent renewal, etc.).
        // Initiate redirect and signal the caller to suppress errors.
        try {
          await authService.acquireTokenRedirect({ ...request, account });
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
