import { describe, it, expect, vi } from 'vitest';
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
});
