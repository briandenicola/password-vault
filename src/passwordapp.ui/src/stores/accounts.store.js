import { defineStore } from 'pinia';
import PasswordService from '@/components/api/Password.Service.js';

const STALE_AFTER_MS = 5 * 60 * 1000;

export const useAccountsStore = defineStore('accounts', {
  state: () => ({
    accounts: [],
    loading: false,
    error: '',
    loadedAt: 0,
    pendingFetch: null,
  }),
  getters: {
    isLoaded: (state) => state.loadedAt > 0,
    isStale: (state) => !state.loadedAt || Date.now() - state.loadedAt > STALE_AFTER_MS,
  },
  actions: {
    async fetchAccounts({ force = false } = {}) {
      if (!force && this.isLoaded && !this.isStale) {
        return this.accounts;
      }

      if (this.pendingFetch) {
        return this.pendingFetch;
      }

      const hadLoadedAccounts = this.isLoaded;
      this.loading = true;
      this.error = '';
      this.pendingFetch = PasswordService.getAll()
        .then((response) => {
          this.accounts = Array.isArray(response.data) ? response.data : [];
          this.loadedAt = Date.now();
          return this.accounts;
        })
        .catch((err) => {
          if (!hadLoadedAccounts) {
            this.accounts = [];
            this.loadedAt = 0;
          }
          this.error = this.describeApiError(err, 'Unable to load accounts');
          throw err;
        })
        .finally(() => {
          this.loading = false;
          this.pendingFetch = null;
        });

      return this.pendingFetch;
    },
    async refreshAccounts() {
      return this.fetchAccounts({ force: true });
    },
    invalidateAccounts() {
      this.loadedAt = 0;
    },
    removeAccount(id) {
      this.accounts = this.accounts.filter(account => account.id !== id);
      if (this.isLoaded) {
        this.loadedAt = Date.now();
      }
    },
    upsertAccount(account) {
      if (!account || !account.id) {
        this.invalidateAccounts();
        return;
      }

      if (!this.isLoaded) {
        this.invalidateAccounts();
        return;
      }

      const index = this.accounts.findIndex(existing => existing.id === account.id);
      if (index >= 0) {
        this.accounts.splice(index, 1, account);
      } else {
        this.accounts.push(account);
      }
      this.loadedAt = Date.now();
    },
    async createAccount(payload) {
      const response = await PasswordService.create(payload);
      this.upsertAccount(response.data);
      return response;
    },
    async updateAccount(id, payload) {
      const response = await PasswordService.update(id, payload);
      this.upsertAccount(response.data);
      return response;
    },
    async deleteAccount(id) {
      const response = await PasswordService.delete(id);
      this.removeAccount(id);
      return response;
    },
    async restoreAccount(id) {
      const response = await PasswordService.restore(id);
      this.invalidateAccounts();
      return response;
    },
    describeApiError(error, fallback) {
      if (error.response) {
        const detail = typeof error.response.data === 'string'
          ? error.response.data
          : error.response.data?.error || error.response.statusText;
        return `${fallback}: ${error.response.status}${detail ? ` - ${detail}` : ''}`;
      }
      if (error.request) {
        return `${fallback}: API request failed before a response was received. Check CORS, network access, and the configured API URL.`;
      }
      return `${fallback}: ${error.message || error}`;
    },
  },
});
