import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAccountsStore } from '@/stores/accounts.store.js';
import PasswordService from '@/components/api/Password.Service.js';

vi.mock('@/components/api/Password.Service.js', () => ({
  default: {
    getAll: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    restore: vi.fn(),
  },
}));

describe('accounts.store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });

  it('caches account list fetches until forced or stale', async () => {
    PasswordService.getAll.mockResolvedValue({ data: [{ id: 'one', accountName: 'alice' }] });
    const store = useAccountsStore();

    await expect(store.fetchAccounts()).resolves.toEqual([{ id: 'one', accountName: 'alice' }]);
    await expect(store.fetchAccounts()).resolves.toEqual([{ id: 'one', accountName: 'alice' }]);

    expect(PasswordService.getAll).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight fetch between callers', async () => {
    let resolveFetch;
    PasswordService.getAll.mockReturnValue(new Promise(resolve => { resolveFetch = resolve; }));
    const store = useAccountsStore();

    const first = store.fetchAccounts();
    const second = store.fetchAccounts();
    resolveFetch({ data: [{ id: 'one' }] });

    await expect(Promise.all([first, second])).resolves.toEqual([[{ id: 'one' }], [{ id: 'one' }]]);
    expect(PasswordService.getAll).toHaveBeenCalledTimes(1);
  });

  it('updates cached rows after delete', async () => {
    const store = useAccountsStore();
    store.accounts = [{ id: 'one' }, { id: 'two' }];
    store.loadedAt = Date.now();
    PasswordService.delete.mockResolvedValue({ data: {} });

    await store.deleteAccount('one');

    expect(store.accounts).toEqual([{ id: 'two' }]);
  });

  it('invalidates when create returns no account body', async () => {
    const store = useAccountsStore();
    store.accounts = [{ id: 'one' }];
    store.loadedAt = Date.now();
    PasswordService.create.mockResolvedValue({ data: null });

    await store.createAccount({ accountName: 'new' });

    expect(store.loadedAt).toBe(0);
  });

  it('does not treat a single created account as a loaded full list', async () => {
    const store = useAccountsStore();
    PasswordService.create.mockResolvedValue({ data: { id: 'new', accountName: 'new' } });

    await store.createAccount({ accountName: 'new' });

    expect(store.accounts).toEqual([]);
    expect(store.loadedAt).toBe(0);
  });
});
