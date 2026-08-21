import { RedirectInProgressError } from '../azuread/AzureAD.Authentication.js';

function isVaultApiRequest(config) {
  const url = config?.url || '';
  return url.startsWith('/api/') || url.includes('/api/');
}

export function configureAuthenticatedAxios(http, authentication, { enabled = true } = {}) {
  if (!enabled) {
    return;
  }

  http.interceptors.request.use(async (config) => {
    if (!isVaultApiRequest(config)) {
      return config;
    }

    let token;
    try {
      token = await authentication.getBearerToken();
    } catch (err) {
      if (err instanceof RedirectInProgressError) {
        // A redirect to the identity provider is in flight. Return a promise
        // that never settles so no false "unable to acquire token" error is
        // surfaced while the browser navigates to authentication. The pending
        // promise is discarded when the page unloads after the redirect.
        return new Promise(() => {});
      }
      throw err;
    }

    if (!token) {
      throw new Error('Unable to acquire an API access token for the vault request.');
    }

    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}
