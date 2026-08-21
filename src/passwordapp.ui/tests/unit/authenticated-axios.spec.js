import { describe, it, expect, vi } from 'vitest';
import { RedirectInProgressError } from '@/components/azuread/AzureAD.Authentication.js';
import { configureAuthenticatedAxios } from '@/components/api/authenticated-axios.js';

function makeHttp() {
  let requestHandler = null;
  return {
    interceptors: {
      request: {
        use(handler) {
          requestHandler = handler;
        },
      },
    },
    async apply(config) {
      if (!requestHandler) {
        return config;
      }
      return requestHandler(config);
    },
  };
}

describe('configureAuthenticatedAxios', () => {
  it('attaches a fresh bearer token to vault API requests', async () => {
    const http = makeHttp();
    const authentication = { getBearerToken: vi.fn().mockResolvedValue('api-token') };

    configureAuthenticatedAxios(http, authentication);
    const config = await http.apply({ url: '/api/passwords', headers: {} });

    expect(authentication.getBearerToken).toHaveBeenCalledTimes(1);
    expect(config.headers.Authorization).toBe('Bearer api-token');
  });

  it('does not attach tokens to non-vault requests', async () => {
    const http = makeHttp();
    const authentication = { getBearerToken: vi.fn() };

    configureAuthenticatedAxios(http, authentication);
    const config = await http.apply({ url: 'https://api.pwnedpasswords.com/range/ABC' });

    expect(authentication.getBearerToken).not.toHaveBeenCalled();
    expect(config.headers).toBeUndefined();
  });

  it('fails the API request when no access token can be acquired', async () => {
    const http = makeHttp();
    const authentication = { getBearerToken: vi.fn().mockResolvedValue(null) };

    configureAuthenticatedAxios(http, authentication);

    await expect(http.apply({ url: '/api/passwords' }))
      .rejects.toThrow('Unable to acquire an API access token');
  });

  it('leaves local auth-disabled API requests untouched', async () => {
    const http = makeHttp();
    const authentication = { getBearerToken: vi.fn() };

    configureAuthenticatedAxios(http, authentication, { enabled: false });
    const config = await http.apply({ url: '/api/passwords' });

    expect(authentication.getBearerToken).not.toHaveBeenCalled();
    expect(config.headers).toBeUndefined();
  });

  it('silently suppresses the request without error when a redirect is in progress', async () => {
    const http = makeHttp();
    const authentication = { getBearerToken: vi.fn().mockRejectedValue(new RedirectInProgressError()) };

    configureAuthenticatedAxios(http, authentication);

    // A redirect-in-progress means the browser is navigating to the identity provider.
    // The interceptor must return a never-settling promise so no false error banner is
    // shown. We verify the promise neither resolves nor rejects within the next tick.
    const result = await Promise.race([
      http.apply({ url: '/api/passwords' }).then(() => 'resolved', () => 'rejected'),
      Promise.resolve().then(() => 'pending'),
    ]);
    expect(result).toBe('pending');
    expect(authentication.getBearerToken).toHaveBeenCalledTimes(1);
  });

  it('propagates non-redirect errors from getBearerToken', async () => {
    const http = makeHttp();
    const authError = new Error('MSAL config error');
    const authentication = { getBearerToken: vi.fn().mockRejectedValue(authError) };

    configureAuthenticatedAxios(http, authentication);

    await expect(http.apply({ url: '/api/passwords' })).rejects.toThrow('MSAL config error');
  });
});
