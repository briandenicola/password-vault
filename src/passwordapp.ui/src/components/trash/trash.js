import PasswordService from '@/components/api/Password.Service.js';
import Moment from 'moment';
import { useAccountsStore } from '@/stores/accounts.store.js';

export default {
  name: 'RecycleBin',
  data() {
    return {
      loading: false,
      error: '',
      message: '',
      restoringId: null,
      entries: [],
      accountsStore: useAccountsStore(),
    };
  },
  created() {
    this.fetchDeleted();
  },
  methods: {
    formatDate(date) {
      return date ? Moment(date).format('MM/DD/YYYY h:mm a') : '';
    },
    async fetchDeleted() {
      this.loading = true;
      this.error = '';
      try {
        const response = await PasswordService.getDeleted();
        this.entries = Array.isArray(response.data) ? response.data : [];
      } catch (err) {
        this.error = 'Unable to load deleted accounts: ' +
          (err && err.message ? err.message : err);
      } finally {
        this.loading = false;
      }
    },
    async restore(row) {
      this.restoringId = row.id;
      this.error = '';
      this.message = '';
      try {
        await this.accountsStore.restoreAccount(row.id);
        this.entries = this.entries.filter(e => e.id !== row.id);
        this.message = `Restored "${row.accountName || row.siteName}" to the vault.`;
      } catch (err) {
        this.error = 'Unable to restore account: ' +
          (err && err.message ? err.message : err);
      } finally {
        this.restoringId = null;
      }
    },
  },
};
