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
    redirectUri: process.env.VUE_APP_AAD_REDIRECT_URL,
  },
  cache: {
    cacheLocation: "localStorage",
    storeAuthStateInCookie: false,
  },
};

// Injectable for tests; defaults to a real PublicClientApplication.
let authService = new msal.PublicClientApplication(msalConfig);
let initialization = null;

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

const api = {
  tokenRequest: {
    scopes: [process.env.VUE_APP_AAD_SCOPE],
  },

  loginRequest: {
    scopes: ["User.Read"],
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
      return null;
    }

    try {
      return await authService.acquireTokenSilent({ ...request, account });
    } catch (error) {
      if (error instanceof msal.InteractionRequiredAuthError) {
        await authService.acquireTokenRedirect({ ...request, account });
      }
      return null;
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
