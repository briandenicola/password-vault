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

    const token = await authentication.getBearerToken();
    if (!token) {
      throw new Error('Unable to acquire an API access token for the vault request.');
    }

    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
}
